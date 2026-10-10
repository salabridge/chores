import {
	choreCompletions,
	choreInstances,
	choreRotationMembers,
	choreRotations,
	choreSkips,
	choreStageProgress,
	choreStages,
	chores,
	householdMembers,
} from '@chore/db';
import { addDays, chorePeriodStart, localDate } from '@chore/db/recurrence';
import { skipKey } from '@chore/db/streaks';
import { and, eq, gte, inArray, isNull } from 'drizzle-orm';
import {
	buildNotes,
	buildWorkload,
	type ChoreStatus,
	type ChoreStatusRow,
	dueText,
	familyStreakDays,
	type HouseholdOverview,
	handoffText,
	percentOf,
	rotationChain,
	sortRows,
	type UpcomingRotation,
} from '../overview.ts';
import { db } from './drizzle.ts';
import { householdClock } from './household-today.ts';

// Reads for the Household Overview (SB-46). Like the rotation loops, the web
// app talks to Postgres as the table owner, so every query is scoped by the
// `householdId` from the caller's own profile and the page load must be
// parent-only.

/** Days of completions to look back over for the interim family streak. */
const STREAK_LOOKBACK_DAYS = 90;

export async function loadHouseholdOverview(
	householdId: string,
	now: Date = new Date(),
): Promise<HouseholdOverview> {
	const since = new Date(now.getTime() - STREAK_LOOKBACK_DAYS * 86_400_000);

	const [
		choreRows,
		memberRows,
		rotationRows,
		loopMemberRows,
		recent,
		{ timeZone, today },
		skips,
	] = await Promise.all([
		db.select().from(chores).where(eq(chores.householdId, householdId)),
		db
			.select({ id: householdMembers.id, name: householdMembers.displayName })
			.from(householdMembers)
			.where(eq(householdMembers.householdId, householdId)),
		db
			.select()
			.from(choreRotations)
			.where(eq(choreRotations.householdId, householdId)),
		db
			.select({
				choreId: choreRotationMembers.choreId,
				memberId: choreRotationMembers.memberId,
				position: choreRotationMembers.position,
				eligible: choreRotationMembers.eligible,
				reason: choreRotationMembers.exclusionReason,
			})
			.from(choreRotationMembers)
			.where(eq(choreRotationMembers.householdId, householdId)),
		db
			.select({ completedAt: choreCompletions.completedAt })
			.from(choreCompletions)
			.where(
				and(
					eq(choreCompletions.householdId, householdId),
					isNull(choreCompletions.reopenedAt),
					gte(choreCompletions.completedAt, since),
				),
			),
		householdClock(householdId, now),
		// A parent's Skip of a personal chore (SB-29) takes it off the list for
		// its period. Only periods that can still be current matter (a weekly
		// period is at most 7 days); bound by UTC today minus 8 so any time zone
		// is covered without waiting on the household's own date.
		db
			.select({
				choreId: choreSkips.choreId,
				periodStart: choreSkips.periodStart,
			})
			.from(choreSkips)
			.where(
				and(
					eq(choreSkips.householdId, householdId),
					gte(choreSkips.periodStart, addDays(localDate('UTC', now), -8)),
				),
			),
	]);

	const names = new Map(memberRows.map((m) => [m.id, m.name]));
	const rotations = new Map(rotationRows.map((r) => [r.choreId, r]));
	const choreById = new Map(choreRows.map((c) => [c.id, c]));

	// Today's period for each chore; a chore that doesn't occur today (a
	// weekends chore on a weekday) isn't due, so it has no row.
	// A skipped rotation turn has already moved on, so its loop stays listed.
	const skipped = new Set(skips.map((s) => skipKey(s.choreId, s.periodStart)));
	const dueChores = choreRows.flatMap((chore) => {
		const periodStart = chorePeriodStart(chore.frequency, today);
		if (!periodStart) return [];
		if (
			chore.type === 'personal' &&
			skipped.has(skipKey(chore.id, periodStart))
		) {
			return [];
		}
		return [{ chore, periodStart }];
	});
	const choreIds = dueChores.map((d) => d.chore.id);

	const [instances, stages] = choreIds.length
		? await Promise.all([
				db
					.select()
					.from(choreInstances)
					.where(
						and(
							eq(choreInstances.householdId, householdId),
							inArray(choreInstances.choreId, choreIds),
						),
					),
				db
					.select({ id: choreStages.id, choreId: choreStages.choreId })
					.from(choreStages)
					.where(
						and(
							eq(choreStages.householdId, householdId),
							inArray(choreStages.choreId, choreIds),
						),
					),
			])
		: [[], []];

	const instanceByChore = new Map(
		instances.flatMap((i) => {
			const due = dueChores.find((d) => d.chore.id === i.choreId);
			return due && due.periodStart === i.periodStart
				? [[i.choreId, i] as const]
				: [];
		}),
	);
	const instanceIds = [...instanceByChore.values()].map((i) => i.id);

	const [completions, progress] = instanceIds.length
		? await Promise.all([
				db
					.select({
						id: choreCompletions.id,
						instanceId: choreCompletions.instanceId,
						memberId: choreCompletions.memberId,
					})
					.from(choreCompletions)
					.where(
						and(
							eq(choreCompletions.householdId, householdId),
							inArray(choreCompletions.instanceId, instanceIds),
							isNull(choreCompletions.reopenedAt),
						),
					),
				db
					.select({ instanceId: choreStageProgress.instanceId })
					.from(choreStageProgress)
					.where(
						and(
							eq(choreStageProgress.householdId, householdId),
							inArray(choreStageProgress.instanceId, instanceIds),
						),
					),
			])
		: [[], []];

	const completionByInstance = new Map(
		completions.map((c) => [c.instanceId, c.id]),
	);
	const completerByInstance = new Map(
		completions.map((c) => [c.instanceId, c.memberId]),
	);
	const stageCount = (choreId: string) =>
		stages.filter((s) => s.choreId === choreId).length;
	const doneCount = (instanceId: string) =>
		progress.filter((p) => p.instanceId === instanceId).length;

	const rows: ChoreStatusRow[] = dueChores.map(({ chore }) => {
		const instance = instanceByChore.get(chore.id) ?? null;
		const rotation = rotations.get(chore.id) ?? null;
		const isLoop = chore.type === 'rotation';
		const completionId = instance
			? (completionByInstance.get(instance.id) ?? null)
			: null;
		const total = stageCount(chore.id);
		const done = instance ? doneCount(instance.id) : 0;

		const assigneeId = isLoop
			? (instance?.assignedMemberId ?? rotation?.currentMemberId ?? null)
			: (instance?.assignedMemberId ?? chore.assignedMemberId);
		const assigneeName = assigneeId ? (names.get(assigneeId) ?? null) : null;

		let status: ChoreStatus = 'todo';
		if (completionId) status = 'completed';
		else if (total > 0 && done > 0) status = 'staged';
		else if (isLoop) status = 'active-turn';

		const due = dueText({
			status,
			stageProgress: total > 0 ? { done, total } : null,
			dueLabel: chore.dueLabel,
			dueTime: chore.dueTime,
			frequency: chore.frequency,
		});
		const owner = isLoop
			? (rotation?.scopeLabel ?? 'Household rotation')
			: assigneeName
				? `${assigneeName}'s personal chore`
				: 'Personal chore';

		return {
			choreId: chore.id,
			instanceId: instance?.id ?? null,
			completionId,
			title: chore.title,
			context: `${owner} • ${due}`,
			assignee:
				assigneeId && assigneeName
					? { memberId: assigneeId, name: assigneeName }
					: null,
			status,
			points: chore.points,
			isLoop,
		};
	});

	const sorted = sortRows(rows.sort((a, b) => a.title.localeCompare(b.title)));

	const loopRows = sorted.filter((r) => r.isLoop);
	const dueSoon = loopRows.filter((r) => r.status !== 'completed');
	const completedToday = sorted.filter((r) => r.status === 'completed').length;

	const exclusions = loopMemberRows
		.filter((e) => !e.eligible)
		.flatMap((e) => {
			const member = names.get(e.memberId);
			const chore = choreById.get(e.choreId);
			return member && chore
				? [
						`${member} is excluded from ${chore.title}${e.reason ? `: ${e.reason}` : ''}.`,
					]
				: [];
		});

	// Who did (or holds) each of today's chores. A finished loop chore's turn
	// has already moved on, so it counts for whoever completed it.
	const workload = buildWorkload(
		memberRows,
		sorted.flatMap((r) => {
			const done = r.status === 'completed';
			const completer = r.instanceId
				? completerByInstance.get(r.instanceId)
				: null;
			const memberId = done
				? (completer ?? r.assignee?.memberId)
				: r.assignee?.memberId;
			return memberId ? [{ memberId, title: r.title, done }] : [];
		}),
	);

	const rowByChore = new Map(sorted.map((r) => [r.choreId, r]));
	const upcoming: UpcomingRotation[] = rotationRows
		.flatMap((rotation) => {
			const chore = choreById.get(rotation.choreId);
			if (!chore || !rotation.currentMemberId) return [];
			const row = rowByChore.get(chore.id);
			const dueToday = !!row && row.status !== 'completed';
			// No row at all means the chore doesn't occur today (a weekends chore on a
			// weekday), which is not the same as today's turn being done.
			const doneToday = row?.status === 'completed';
			const { order, resetAt } = rotationChain(
				loopMemberRows
					.filter((m) => m.choreId === chore.id)
					.flatMap((m) => {
						const name = names.get(m.memberId);
						return name ? [{ ...m, name }] : [];
					}),
				rotation.currentMemberId,
			);
			return [
				{
					choreId: chore.id,
					title: chore.title,
					handoff: handoffText({
						dueToday,
						doneToday,
						dueTime: chore.dueTime,
						dueLabel: chore.dueLabel,
						frequency: chore.frequency,
					}),
					dueToday,
					order,
					resetAt,
				},
			];
		})
		.sort(
			(a, b) =>
				Number(b.dueToday) - Number(a.dueToday) ||
				a.title.localeCompare(b.title),
		);

	const currentTurn = new Map(
		rotationRows.flatMap((r) => {
			const name = r.currentMemberId ? names.get(r.currentMemberId) : null;
			return name ? [[r.choreId, name] as const] : [];
		}),
	);
	const notes = buildNotes({ exclusions, rows: sorted, currentTurn });

	const streakDays = familyStreakDays(
		recent.map((c) => localDate(timeZone, c.completedAt)),
		today,
	);

	return {
		workload,
		rotations: upcoming,
		notes,
		rows: sorted,
		stats: {
			totalChores: choreRows.length,
			sharedLoops: choreRows.filter((c) => c.type === 'rotation').length,
			personalChores: choreRows.filter((c) => c.type === 'personal').length,
			activeRotations: rotationRows.filter((r) => r.currentMemberId).length,
			rotationsDueSoon: dueSoon.length,
			dueSoonTitles: dueSoon.map((r) => r.title),
			completedToday,
			dueToday: sorted.length,
			completedPercent: percentOf(completedToday, sorted.length),
			streakDays,
			exceptions: exclusions.length,
			firstException: exclusions[0] ?? null,
		},
	};
}
