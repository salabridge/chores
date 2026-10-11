import { choreCompletions, householdMembers, pointsLedger } from '@chore/db';
import { weeklyGoalProgress } from '@chore/db/completions';
import { chorePeriodStart } from '@chore/db/recurrence';
import { rotationTurns } from '@chore/db/rotation';
import { and, eq, sql } from 'drizzle-orm';
import type { CompletionSummary } from '../chore-completion.ts';
import { db } from './drizzle.ts';
import { householdClock } from './household-today.ts';
import { loadChore, loadRotation, UUID } from './rotation-detail.ts';

// What the completion celebration screen (SB-42) shows. Everything here is a
// read: the points come from the completion row and the ledger that SB-26
// wrote when the chore was completed, never from a request, so opening the
// screen again (a refresh, the back button, a shared link) can't award
// anything twice.

/**
 * The summary for one completion, as seen by `viewer`, who must be the member
 * who earned it. Returns `undefined` for anything that isn't theirs (unknown
 * id, another household or member, a chore that doesn't match the URL), and
 * `null` when a parent has since reopened the completion (its points were
 * taken back, so there is nothing to celebrate).
 */
export async function loadCompletionSummary(
	viewer: { id: string; householdId: string; displayName: string },
	choreId: string,
	completionId: string,
	now: Date = new Date(),
): Promise<CompletionSummary | null | undefined> {
	if (!UUID.test(choreId) || !UUID.test(completionId)) return undefined;

	const [completion] = await db
		.select({
			memberId: choreCompletions.memberId,
			points: choreCompletions.points,
			reopenedAt: choreCompletions.reopenedAt,
		})
		.from(choreCompletions)
		.where(
			and(
				eq(choreCompletions.id, completionId),
				eq(choreCompletions.choreId, choreId),
				eq(choreCompletions.householdId, viewer.householdId),
			),
		);
	if (!completion || completion.memberId !== viewer.id) return undefined;
	if (completion.reopenedAt) return null;

	const chore = await loadChore(viewer.householdId, choreId);
	if (!chore) return undefined;

	const [balance] = await db
		.select({
			total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
		})
		.from(pointsLedger)
		.where(eq(pointsLedger.memberId, viewer.id));

	const [member] = await db
		.select({ goal: householdMembers.weeklyGoalPoints })
		.from(householdMembers)
		.where(eq(householdMembers.id, viewer.id));

	// The week is the household's own Monday, as an instant in its time zone.
	const { timeZone, today } = await householdClock(viewer.householdId, now);
	const monday = chorePeriodStart('weekly', today) ?? today;
	const [week] = await db
		.select({
			total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
		})
		.from(pointsLedger)
		.where(
			and(
				eq(pointsLedger.memberId, viewer.id),
				sql`${pointsLedger.reason} in ('completion', 'reversal')`,
				sql`${pointsLedger.createdAt} >= (${monday}::date)::timestamp at time zone ${timeZone}`,
			),
		);

	let rotation: CompletionSummary['rotation'] = null;
	if (chore.type === 'rotation') {
		const loaded = await loadRotation(viewer.householdId, choreId);
		const holder = loaded
			? rotationTurns(
					loaded.members,
					loaded.rotation.currentMemberId,
					loaded.rotation.lastCompletedMemberId,
				).activeTurn
			: null;
		rotation = {
			nextName: holder?.name ?? null,
			nextIsYou: holder?.memberId === viewer.id,
		};
	}

	return {
		choreId,
		title: chore.title,
		memberName: viewer.displayName,
		points: completion.points,
		totalPoints: balance?.total ?? 0,
		rotation,
		goal: weeklyGoalProgress(week?.total ?? 0, member?.goal ?? 0),
	};
}
