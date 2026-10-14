import {
	choreCompletions,
	choreInstances,
	choreSkips,
	chores,
} from '@chore/db';
import { householdStreaks } from '@chore/db/household-streaks';
import { addDays, chorePeriodStart } from '@chore/db/recurrence';
import type { AuthenticatedTx } from '@chore/db/rls';
import { SCREEN_STREAK_LOOKBACK_DAYS, skipKey } from '@chore/db/streaks';
import { and, eq, gte, isNull } from 'drizzle-orm';
import {
	MAX_SUGGESTED_CHORES,
	type RewardsShopView,
	type SuggestedChore,
	shapeRewardsShop,
} from '../rewards-shop.ts';
import { db } from './drizzle.ts';
import { householdClock } from './household-today.ts';
import { loadRewardShop } from './rewards.ts';

// Reads for the Rewards Shop screen (SB-43). Rewards, claims and milestones
// come from rewards.ts (SB-27), the streak from SB-28.

/**
 * Chores the member still has open today: their personal chores and the
 * rotation loops whose turn this period is theirs, minus anything already
 * done or skipped. Used for the "keep the streak warm" chips.
 */
export async function openChoresFor(
	member: { id: string; householdId: string },
	today: string,
): Promise<SuggestedChore[]> {
	// One round trip: the instance read is already bounded by the household
	// and the last week, so it doesn't need to wait for the due chore ids.
	const since = addDays(today, -7);
	const [rows, instances, skips] = await Promise.all([
		db
			.select({
				id: chores.id,
				title: chores.title,
				type: chores.type,
				frequency: chores.frequency,
				assignedMemberId: chores.assignedMemberId,
			})
			.from(chores)
			.where(
				and(
					eq(chores.householdId, member.householdId),
					isNull(chores.archivedAt),
				),
			),
		// At most one open completion per instance (partial unique index), so
		// the join can't fan out.
		db
			.select({
				id: choreInstances.id,
				choreId: choreInstances.choreId,
				periodStart: choreInstances.periodStart,
				assignedMemberId: choreInstances.assignedMemberId,
				completionId: choreCompletions.id,
			})
			.from(choreInstances)
			.leftJoin(
				choreCompletions,
				and(
					eq(choreCompletions.instanceId, choreInstances.id),
					isNull(choreCompletions.reopenedAt),
				),
			)
			.where(
				and(
					eq(choreInstances.householdId, member.householdId),
					gte(choreInstances.periodStart, since),
				),
			),
		db
			.select({
				choreId: choreSkips.choreId,
				periodStart: choreSkips.periodStart,
			})
			.from(choreSkips)
			.where(
				and(
					eq(choreSkips.householdId, member.householdId),
					gte(choreSkips.periodStart, since),
				),
			),
	]);

	const due = rows.flatMap((chore) => {
		const periodStart = chorePeriodStart(chore.frequency, today);
		return periodStart ? [{ chore, periodStart }] : [];
	});
	if (due.length === 0) return [];

	const done = new Set(
		instances.flatMap((i) => (i.completionId ? [i.id] : [])),
	);
	const skipped = new Set(skips.map((s) => skipKey(s.choreId, s.periodStart)));
	const instanceOf = new Map(
		instances.map((i) => [skipKey(i.choreId, i.periodStart), i]),
	);

	return due
		.filter(({ chore, periodStart }) => {
			const key = skipKey(chore.id, periodStart);
			const instance = instanceOf.get(key);
			if (instance && done.has(instance.id)) return false;
			if (chore.type === 'personal') {
				return chore.assignedMemberId === member.id && !skipped.has(key);
			}
			// A rotation's turn only exists once its period's instance does.
			return instance?.assignedMemberId === member.id;
		})
		.map(({ chore }) => ({ id: chore.id, title: chore.title }))
		.slice(0, MAX_SUGGESTED_CHORES);
}

/** The member's current personal streak in days (SB-28). */
export async function personalStreakDays(
	member: { id: string; householdId: string },
	now: Date,
): Promise<number> {
	// householdStreaks only runs plain selects, which the web app's owner-role
	// client runs the same as an RLS transaction; the query is scoped by the
	// household of the caller's own profile.
	const streaks = await householdStreaks(
		db as unknown as AuthenticatedTx,
		member.householdId,
		{ now, lookbackDays: SCREEN_STREAK_LOOKBACK_DAYS },
	);
	return streaks.members[member.id]?.days ?? 0;
}

export async function loadRewardsShop(
	member: { id: string; householdId: string },
	now: Date = new Date(),
): Promise<RewardsShopView> {
	// Only the chips need the household's date; the rest doesn't wait on it.
	const [shop, streakDays, suggested] = await Promise.all([
		loadRewardShop(member, now),
		personalStreakDays(member, now),
		householdClock(member.householdId, now).then(({ today }) =>
			openChoresFor(member, today),
		),
	]);
	return shapeRewardsShop({ shop, streakDays, suggested });
}
