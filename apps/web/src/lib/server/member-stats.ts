import { pointsLedger } from '@chore/db';
import { householdStreaks } from '@chore/db/household-streaks';
import type { AuthenticatedTx } from '@chore/db/rls';
import { SCREEN_STREAK_LOOKBACK_DAYS, type Streak } from '@chore/db/streaks';
import { and, eq, sql } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { db } from './drizzle.ts';

// A member's points balance and personal streak, for any screen that shows
// them (the Today header, the Rewards shop, the Streak tab). As in chores.ts
// the web app is the table owner, so RLS doesn't apply: callers pass the
// member of their own profile (`getCurrentMember()`), never an id from input.

const balances = new WeakMap<App.Locals, Map<string, Promise<number>>>();

/**
 * A member's points: the sum of their ledger rows. Memoized per request, so
 * the shell header, Today, Streak and the Rewards shop share one sum. Writes
 * that change the balance redirect, so the next read is a fresh request.
 */
export function memberPointsBalance(memberId: string): Promise<number> {
	const { locals } = getRequestEvent();
	let byMember = balances.get(locals);
	if (!byMember) {
		byMember = new Map();
		balances.set(locals, byMember);
	}
	let total = byMember.get(memberId);
	if (!total) {
		total = queryPointsBalance(memberId);
		byMember.set(memberId, total);
	}
	return total;
}

/** `memberPointsBalance` without the memo, for a check that must see the latest write. */
export async function queryPointsBalance(memberId: string): Promise<number> {
	const [row] = await db
		.select({
			total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
		})
		.from(pointsLedger)
		.where(eq(pointsLedger.memberId, memberId));
	return row?.total ?? 0;
}

/**
 * Points a member earned from completions since `monday` (household-local,
 * in `timeZone`), net of reversals. Claims and adjustments don't count, the
 * same as the weekly goal on the completion screen (completion-summary.ts).
 */
export async function memberWeekPoints(
	memberId: string,
	timeZone: string,
	monday: string,
): Promise<number> {
	const [row] = await db
		.select({
			total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
		})
		.from(pointsLedger)
		.where(
			and(
				eq(pointsLedger.memberId, memberId),
				sql`${pointsLedger.reason} in ('completion', 'reversal')`,
				sql`${pointsLedger.createdAt} >= (${monday}::date)::timestamp at time zone ${timeZone}`,
			),
		);
	return Math.max(0, row?.total ?? 0);
}

/**
 * A member's current streak (SB-28), counted in the household's time zone.
 * Reuses `householdStreaks()`, which was written for an RLS transaction; it
 * only issues plain `select`s, which the owner client runs the same way, so
 * the cast is safe and keeps the streak rules in one place. The walk is
 * capped at `SCREEN_STREAK_LOOKBACK_DAYS`, so a longer streak shows as that.
 */
export async function memberStreak(
	household: { id: string },
	memberId: string,
	now: Date = new Date(),
): Promise<Streak> {
	const streaks = await householdStreaks(
		db as unknown as AuthenticatedTx,
		household.id,
		{ now, lookbackDays: SCREEN_STREAK_LOOKBACK_DAYS },
	);
	return streaks.members[memberId] ?? { days: 0, exceptions: 0 };
}
