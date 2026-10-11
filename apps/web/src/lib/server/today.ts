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
import { rotationTurns } from '@chore/db/rotation';
import { skipKey } from '@chore/db/streaks';
import { and, eq, gte, inArray, isNull } from 'drizzle-orm';
import {
	buildToday,
	type PersonalFacts,
	type RotationFacts,
	type TodayData,
} from '../today.ts';
import { db } from './drizzle.ts';
import { householdClock } from './household-today.ts';
import { memberPointsBalance, memberStreak } from './member-stats.ts';

// Reads for the Today screen (SB-39). As in overview.ts, every query is scoped
// by the household of the caller's own profile; `member` must come from
// `getCurrentMember()`. The decisions (sort order, priority pick, wording) are
// in `../today.ts` so they can be tested without a database.

/** What `member` has on today: personal chores, rotations, points and streak. */
export async function loadToday(
	member: { id: string; householdId: string; displayName: string },
	now: Date = new Date(),
): Promise<TodayData> {
	const householdId = member.householdId;
	const [choreRows, memberRows, rotationRows, loopMembers, clock, skips] =
		await Promise.all([
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
				})
				.from(choreRotationMembers)
				.where(eq(choreRotationMembers.householdId, householdId)),
			householdClock(householdId, now),
			// A parent's Skip takes a personal chore off the list for its period;
			// see overview.ts for why the bound is UTC today minus 8.
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
	const rotationByChore = new Map(rotationRows.map((r) => [r.choreId, r]));
	const skipped = new Set(skips.map((s) => skipKey(s.choreId, s.periodStart)));

	// A rotation is the viewer's if they are an eligible member of its loop.
	const viewerLoops = new Set(
		loopMembers
			.filter((m) => m.memberId === member.id && m.eligible)
			.map((m) => m.choreId),
	);

	// Chores that occur today. The rest (a weekends chore on a weekday) aren't
	// due, so they have no card.
	const dueChores = choreRows.flatMap((chore) => {
		const periodStart = chorePeriodStart(chore.frequency, clock.today);
		return periodStart ? [{ chore, periodStart }] : [];
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
					.select({ choreId: choreStages.choreId })
					.from(choreStages)
					.where(
						and(
							eq(choreStages.householdId, householdId),
							inArray(choreStages.choreId, choreIds),
						),
					),
			])
		: [[], []];

	const periodByChore = new Map(
		dueChores.map((d) => [d.chore.id, d.periodStart]),
	);
	const instanceByChore = new Map(
		instances.flatMap((i) =>
			periodByChore.get(i.choreId) === i.periodStart
				? [[i.choreId, i] as const]
				: [],
		),
	);
	const instanceIds = [...instanceByChore.values()].map((i) => i.id);

	const [completions, progress] = instanceIds.length
		? await Promise.all([
				db
					.select({
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

	const completerByInstance = new Map(
		completions.map((c) => [c.instanceId, c.memberId]),
	);
	const stagesFor = (choreId: string, instanceId: string | undefined) => ({
		total: stages.filter((s) => s.choreId === choreId).length,
		done: instanceId
			? progress.filter((p) => p.instanceId === instanceId).length
			: 0,
	});

	const personal: PersonalFacts[] = [];
	const rotations: RotationFacts[] = [];
	for (const { chore, periodStart } of dueChores) {
		const instance = instanceByChore.get(chore.id);
		const completed = instance ? completerByInstance.has(instance.id) : false;

		if (chore.type === 'personal') {
			const owner = instance?.assignedMemberId ?? chore.assignedMemberId;
			if (owner !== member.id) continue;
			if (skipped.has(skipKey(chore.id, periodStart))) continue;
			personal.push({
				choreId: chore.id,
				title: chore.title,
				points: chore.points,
				frequency: chore.frequency,
				dueTime: chore.dueTime,
				dueLabel: chore.dueLabel,
				stages: stagesFor(chore.id, instance?.id),
				completed,
			});
			continue;
		}

		if (!viewerLoops.has(chore.id)) continue;
		const rotation = rotationByChore.get(chore.id);
		// The same turn the rotation screen shows: the stored one if still
		// eligible, otherwise the first eligible member.
		const turn = rotation
			? rotationTurns(
					loopMembers.filter((m) => m.choreId === chore.id),
					rotation.currentMemberId,
					rotation.lastCompletedMemberId,
				).activeTurn
			: null;
		const completerId = instance ? completerByInstance.get(instance.id) : null;
		rotations.push({
			choreId: chore.id,
			title: chore.title,
			points: chore.points,
			turnMemberId: turn?.memberId ?? null,
			turnMemberName: turn ? (names.get(turn.memberId) ?? null) : null,
			stages: stagesFor(chore.id, instance?.id),
			completed,
			completedByName: completerId ? (names.get(completerId) ?? null) : null,
		});
	}

	const [points, streak] = await Promise.all([
		memberPointsBalance(member.id),
		memberStreak({ id: householdId }, member.id, now),
	]);

	return buildToday({
		member: { id: member.id, name: member.displayName },
		points,
		streak,
		personal,
		rotations,
	});
}
