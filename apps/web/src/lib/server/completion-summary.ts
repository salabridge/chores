import { choreCompletions, householdMembers, pointsLedger } from '@chore/db';
import { weeklyGoalProgress } from '@chore/db/completions';
import { chorePeriodStart } from '@chore/db/recurrence';
import { rotationTurns } from '@chore/db/rotation';
import { and, eq, sql } from 'drizzle-orm';
import type { CompletionSummary } from '../chore-completion.ts';
import { db } from './drizzle.ts';
import { householdClock } from './household-today.ts';
import {
	householdMemberName,
	loadChore,
	loadRotation,
	UUID,
} from './rotation-detail.ts';

// What the completion celebration screen (SB-42) shows. Everything here is a
// read: the points come from the completion row and the ledger that SB-26
// wrote when the chore was completed, never from a request, so opening the
// screen again (a refresh, the back button, a shared link) can't award
// anything twice.

/**
 * The summary for one completion, as seen by `viewer`, who must be the member
 * who earned it: the assignee, or whoever did it for them (SB-74), in which
 * case `doneFor` names the assignee. Returns `undefined` for anything that isn't theirs (unknown
 * id, another household or member, a chore that doesn't match the URL), and
 * `null` when a parent has since reopened the completion (its points were
 * taken back, so there is nothing to celebrate) or the favour was declined
 * (SB-79). A favour still waiting for its OK has `approvalStatus: 'pending'`.
 */
export async function loadCompletionSummary(
	viewer: { id: string; householdId: string; displayName: string },
	choreId: string,
	completionId: string,
	now: Date = new Date(),
): Promise<CompletionSummary | null | undefined> {
	if (!UUID.test(choreId) || !UUID.test(completionId)) return undefined;

	// One fan-out. The ownership check runs alongside the rest rather than
	// before it: everything else read here is the viewer's own (their balance,
	// goal and household), so nothing is exposed when the check then fails.
	// This is the screen every completion lands on, so it's on the main loop.
	const [[completion], chore, [member], ledger, loaded] = await Promise.all([
		db
			.select({
				memberId: choreCompletions.memberId,
				doneByMemberId: choreCompletions.doneByMemberId,
				points: choreCompletions.points,
				reopenedAt: choreCompletions.reopenedAt,
				approvalStatus: choreCompletions.approvalStatus,
			})
			.from(choreCompletions)
			.where(
				and(
					eq(choreCompletions.id, completionId),
					eq(choreCompletions.choreId, choreId),
					eq(choreCompletions.householdId, viewer.householdId),
				),
			),
		loadChore(viewer.householdId, choreId),
		db
			.select({ goal: householdMembers.weeklyGoalPoints })
			.from(householdMembers)
			.where(eq(householdMembers.id, viewer.id)),
		// The week is the household's own Monday, as an instant in its time
		// zone, so only the ledger read waits on the clock. Balance and this
		// week's points come from the same scan.
		householdClock(viewer.householdId, now).then(({ timeZone, today }) => {
			const monday = chorePeriodStart('weekly', today) ?? today;
			return db
				.select({
					total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
					week: sql<number>`coalesce(sum(${pointsLedger.delta}) filter (where ${pointsLedger.reason} in ('completion', 'reversal') and ${pointsLedger.createdAt} >= (${monday}::date)::timestamp at time zone ${timeZone}), 0)::int`,
				})
				.from(pointsLedger)
				.where(eq(pointsLedger.memberId, viewer.id));
		}),
		// Null for a personal chore (no rotation row), so running it either way
		// costs at most one indexed lookup.
		loadRotation(viewer.householdId, choreId),
	]);
	// The points (and so the celebration) are the doer's when someone did the
	// chore for its assignee.
	const credited = completion?.doneByMemberId ?? completion?.memberId;
	if (!completion || credited !== viewer.id) return undefined;
	if (completion.reopenedAt || completion.approvalStatus === 'declined') {
		return null;
	}
	if (!chore) return undefined;
	let doneFor: CompletionSummary['doneFor'] = null;
	if (completion.doneByMemberId && completion.memberId) {
		const name = await householdMemberName(
			viewer.householdId,
			completion.memberId,
		);
		if (name) doneFor = { memberId: completion.memberId, name };
	}
	const [totals] = ledger;

	let rotation: CompletionSummary['rotation'] = null;
	if (chore.type === 'rotation') {
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
		doneFor,
		points: completion.points,
		approvalStatus: completion.approvalStatus,
		totalPoints: totals?.total ?? 0,
		rotation,
		goal: weeklyGoalProgress(totals?.week ?? 0, member?.goal ?? 0),
	};
}
