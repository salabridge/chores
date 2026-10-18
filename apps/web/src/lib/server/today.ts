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
import { householdStreaks } from '@chore/db/household-streaks';
import { addDays, chorePeriodStart, localDate } from '@chore/db/recurrence';
import type { AuthenticatedTx } from '@chore/db/rls';
import { rotationTurns } from '@chore/db/rotation';
import { SCREEN_STREAK_LOOKBACK_DAYS, skipKey } from '@chore/db/streaks';
import { and, eq, gte, inArray, isNull } from 'drizzle-orm';
import { streakWeek } from '../streak.ts';
import {
	buildToday,
	type PersonalFacts,
	type RotationFacts,
	type TodayData,
} from '../today.ts';
import { db } from './drizzle.ts';
import { householdClock } from './household-today.ts';
import { memberPointsBalance, memberWeekPoints } from './member-stats.ts';

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
	// Everything that doesn't depend on the household's date goes out in the
	// first round trip, so the page costs two: this, then the period's rows.
	const [
		choreRows,
		memberRows,
		rotationRows,
		loopMembers,
		stages,
		[clock, weekPoints],
		skips,
		points,
		streaks,
	] = await Promise.all([
		db
			.select()
			.from(chores)
			.where(
				and(eq(chores.householdId, householdId), isNull(chores.archivedAt)),
			),
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
		db
			.select({ choreId: choreStages.choreId })
			.from(choreStages)
			.where(eq(choreStages.householdId, householdId)),
		// The week's points need the household's date and time zone.
		householdClock(householdId, now).then((clock) =>
			Promise.all([
				clock,
				memberWeekPoints(
					member.id,
					clock.timeZone,
					chorePeriodStart('weekly', clock.today) ?? clock.today,
				),
			]),
		),
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
		memberPointsBalance(member.id),
		// See member-stats.ts for why the owner client can run this. The whole
		// result, not just this member's streak, because Weekly Progress needs `due`.
		householdStreaks(db as unknown as AuthenticatedTx, householdId, {
			now,
			lookbackDays: SCREEN_STREAK_LOOKBACK_DAYS,
		}),
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
	// At most two distinct values (today, this Monday), so the instance reads
	// stay bounded to the current periods instead of the chore's whole history.
	const periodStarts = [...new Set(dueChores.map((d) => d.periodStart))];
	const currentInstances = and(
		eq(choreInstances.householdId, householdId),
		inArray(choreInstances.choreId, choreIds),
		inArray(choreInstances.periodStart, periodStarts),
	);

	const [instances, progress] = choreIds.length
		? await Promise.all([
				// At most one open completion per instance (partial unique index),
				// so the join can't fan out.
				db
					.select({
						id: choreInstances.id,
						choreId: choreInstances.choreId,
						periodStart: choreInstances.periodStart,
						assignedMemberId: choreInstances.assignedMemberId,
						completerId: choreCompletions.memberId,
					})
					.from(choreInstances)
					.leftJoin(
						choreCompletions,
						and(
							eq(choreCompletions.instanceId, choreInstances.id),
							isNull(choreCompletions.reopenedAt),
						),
					)
					.where(currentInstances),
				db
					.select({ instanceId: choreStageProgress.instanceId })
					.from(choreStageProgress)
					.innerJoin(
						choreInstances,
						eq(choreInstances.id, choreStageProgress.instanceId),
					)
					.where(currentInstances),
			])
		: [[], []];

	// The period lists are shared, so a daily chore can also match its Monday
	// instance; keep only the one for the chore's own period.
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

	const countBy = <T>(rows: T[], key: (row: T) => string) => {
		const counts = new Map<string, number>();
		for (const row of rows) {
			counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
		}
		return counts;
	};
	const stageTotals = countBy(stages, (s) => s.choreId);
	const stagesDone = countBy(progress, (p) => p.instanceId);
	const stagesFor = (choreId: string, instanceId: string | undefined) => ({
		total: stageTotals.get(choreId) ?? 0,
		done: instanceId ? (stagesDone.get(instanceId) ?? 0) : 0,
	});

	const personal: PersonalFacts[] = [];
	const rotations: RotationFacts[] = [];
	for (const { chore, periodStart } of dueChores) {
		const instance = instanceByChore.get(chore.id);
		const completed = instance?.completerId != null;

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
		const completerId = instance?.completerId;
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

	return buildToday({
		member: { id: member.id, name: member.displayName },
		points,
		streak: streaks.members[member.id] ?? { days: 0, exceptions: 0 },
		// TODO(SB-68): whether "X of Y completed" counts the whole week or, as
		// the Streak tab does, only what was due through today is undecided.
		// streakWeek() is the one place that counts it.
		week: streakWeek({
			memberId: member.id,
			today: streaks.today,
			due: streaks.due,
			points: weekPoints,
		}),
		personal,
		rotations,
	});
}
