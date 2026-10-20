import { householdMembers, pointsLedger } from '@chore/db';
import { and, desc, eq, gt, gte, isNull, notLike } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { type GiftInput, type GiftItem, parseGiftInput } from '../gift.ts';
import { db } from './drizzle.ts';
import { isParentRole, type MemberSummary } from './profile-state.ts';

// Bonus points (SB-78). A parent gifts points for something that isn't a chore
// (a report card, helping a neighbour) by appending one `adjustment` ledger
// row. As with the other web-side modules the web app talks to Postgres as the
// table owner, so the `points_ledger_insert` policy does not apply here and
// this file checks the same rules itself: the actor is a parent in the
// household, and the member is in that household. Gifts add to the balance
// (and so can be spent) but not to weekly goals or streaks; see "Bonus points"
// in packages/db/README.md.

/** A problem with the request, worded for the form. */
export class GiftError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GiftError';
	}
}

/** Gifts older than this drop off the kid's Rewards screen. */
const RECENT_GIFT_DAYS = 30;
const RECENT_GIFT_LIMIT = 10;

/**
 * Gives `memberId` bonus points. `actor` is the signed-in parent's own member
 * (`ProfileState.actor`), whose household and user id are used; the target is
 * looked up inside that household, never trusted from the request. Gifts go to
 * kids only: a parent has no Rewards screen to spend them on.
 */
export async function giftPoints(
	actor: Pick<MemberSummary, 'householdId' | 'userId' | 'role'>,
	memberId: string,
	input: { points: unknown; reason: unknown },
): Promise<GiftInput> {
	if (!isParentRole(actor.role)) {
		throw new GiftError('Only a parent can give bonus points.');
	}
	const parsed = parseGiftInput(input);
	if (!parsed.ok) throw new GiftError(parsed.message);
	const [target] = await db
		.select({ id: householdMembers.id, role: householdMembers.role })
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.id, memberId),
				eq(householdMembers.householdId, actor.householdId),
				isNull(householdMembers.removedAt),
			),
		);
	if (!target) throw new GiftError('That member was not found.');
	if (target.role !== 'kid') {
		throw new GiftError('Bonus points can only go to a kid.');
	}
	await db.insert(pointsLedger).values({
		householdId: actor.householdId,
		memberId: target.id,
		delta: parsed.value.points,
		reason: 'adjustment',
		note: parsed.value.reason,
		createdBy: actor.userId,
	});
	return parsed.value;
}

const giver = alias(householdMembers, 'giver');

/**
 * Notes of `adjustment` rows the database writes that aren't presents, by
 * their start: a household merge's "Carried over from …" (SB-76) and a
 * removed duplicate profile's "Moved from …" (SB-84, both the credit and the
 * debit). The one place these prefixes are matched; swap it for a marker
 * column if one is added.
 */
export const NOT_A_GIFT_NOTE_PREFIXES = [
	'Carried over from ',
	'Moved from ',
] as const;

/**
 * The bonus points `member` got recently, newest first, for their Rewards
 * screen: positive adjustments. The "Carried over from …" rows a household
 * merge writes (SB-76) and the "Moved from …" rows of a removed duplicate
 * profile (SB-84) are adjustments too but aren't a present, so they're left
 * out by their note (`NOT_A_GIFT_NOTE_PREFIXES`).
 */
export async function listRecentGifts(
	member: { id: string; householdId: string },
	now: Date = new Date(),
): Promise<GiftItem[]> {
	const since = new Date(now.getTime() - RECENT_GIFT_DAYS * 86_400_000);
	const rows = await db
		.select({
			id: pointsLedger.id,
			points: pointsLedger.delta,
			reason: pointsLedger.note,
			fromName: giver.displayName,
			createdAt: pointsLedger.createdAt,
		})
		.from(pointsLedger)
		.leftJoin(
			giver,
			and(
				eq(giver.userId, pointsLedger.createdBy),
				eq(giver.householdId, pointsLedger.householdId),
			),
		)
		.where(
			and(
				eq(pointsLedger.memberId, member.id),
				eq(pointsLedger.householdId, member.householdId),
				eq(pointsLedger.reason, 'adjustment'),
				gt(pointsLedger.delta, 0),
				...NOT_A_GIFT_NOTE_PREFIXES.map((prefix) =>
					notLike(pointsLedger.note, `${prefix}%`),
				),
				gte(pointsLedger.createdAt, since),
			),
		)
		.orderBy(desc(pointsLedger.createdAt), desc(pointsLedger.id))
		.limit(RECENT_GIFT_LIMIT);
	return rows.map((r) => ({
		id: r.id,
		points: r.points,
		reason: r.reason ?? '',
		fromName: r.fromName,
		createdAt: r.createdAt.toISOString(),
	}));
}
