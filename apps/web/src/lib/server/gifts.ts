import { householdMembers, pointsLedger } from '@chore/db';
import { and, desc, eq, gte, isNull, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { type GiftInput, type GiftItem, parseGiftInput } from '../gift.ts';
import { db } from './drizzle.ts';
import {
	isParentRole,
	type MemberSummary,
	type ProfileState,
	seesGiftMoment,
} from './profile-state.ts';
import { sqlState, UUID } from './rotation-detail.ts';

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
	readonly status: 400 | 403;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(message: string, status: 400 | 403 = 400) {
		super(message);
		this.name = 'GiftError';
		this.status = status;
	}
}

/** Gifts older than this drop off the kid's Rewards screen. */
const RECENT_GIFT_DAYS = 30;
const RECENT_GIFT_LIMIT = 10;
/** The most gifts one "You got bonus points!" moment lists (SB-83). */
const UNSEEN_GIFT_LIMIT = 20;

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
		adjustmentKind: 'gift',
		note: parsed.value.reason,
		createdBy: actor.userId,
	});
	return parsed.value;
}

const giver = alias(householdMembers, 'giver');

/** `member`'s gifts matching `extra`, newest first, with who gave them. */
async function selectGifts(
	member: { id: string; householdId: string },
	extra: SQL | undefined,
	limit: number,
): Promise<GiftItem[]> {
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
				// Only gifts: not a parent's correction, and not a balance moved in
				// from another household (SB-76 "Carried over from …") or from a
				// removed duplicate profile (SB-84 "Moved from …"). See
				// `points_adjustment_kind`.
				eq(pointsLedger.reason, 'adjustment'),
				eq(pointsLedger.adjustmentKind, 'gift'),
				extra,
			),
		)
		.orderBy(desc(pointsLedger.createdAt), desc(pointsLedger.id))
		.limit(limit);
	return rows.map((r) => ({
		id: r.id,
		points: r.points,
		reason: r.reason ?? '',
		fromName: r.fromName,
		createdAt: r.createdAt.toISOString(),
	}));
}

/** The bonus points `member` got recently, newest first, for their Rewards screen. */
export async function listRecentGifts(
	member: { id: string; householdId: string },
	now: Date = new Date(),
): Promise<GiftItem[]> {
	const since = new Date(now.getTime() - RECENT_GIFT_DAYS * 86_400_000);
	return selectGifts(
		member,
		gte(pointsLedger.createdAt, since),
		RECENT_GIFT_LIMIT,
	);
}

/**
 * The gifts `member` hasn't dismissed the moment for yet, newest first: those
 * after their `gifts_seen_at`, from the last 30 days (older ones would be
 * stale news; they're still on the Rewards screen's card until then).
 */
export async function listUnseenGifts(
	member: { id: string; householdId: string },
	now: Date = new Date(),
): Promise<GiftItem[]> {
	const since = new Date(now.getTime() - RECENT_GIFT_DAYS * 86_400_000);
	return selectGifts(
		member,
		and(
			gte(pointsLedger.createdAt, since),
			sql`${pointsLedger.createdAt} > coalesce((
				select ${householdMembers.giftsSeenAt} from ${householdMembers}
				where ${householdMembers.id} = ${member.id}
			), '-infinity')`,
		),
		UNSEEN_GIFT_LIMIT,
	);
}

/**
 * Marks the gifts the moment showed as seen, when the kid dismisses it, so it
 * doesn't come back on this or any other device. Runs as the signed-in user
 * (`app.mark_gifts_seen` checks they can act as the kid: their own login, or
 * a parent on a managed kid's profile) and only moves
 * the marker up to the newest of `giftIds`, so a gift that arrived while the
 * moment was open still gets its own.
 */
export async function markGiftsSeen(
	state: ProfileState,
	giftIds: unknown,
): Promise<void> {
	// The signed-in user: the kid themselves, or the parent whose device is
	// on the kid's profile.
	const userId = state.actor.userId;
	if (!seesGiftMoment(state) || !userId) {
		throw new GiftError('Only the kid who got the points can do this.', 403);
	}
	if (
		!Array.isArray(giftIds) ||
		giftIds.length === 0 ||
		giftIds.length > UNSEEN_GIFT_LIMIT ||
		!giftIds.every((id) => typeof id === 'string' && UUID.test(id))
	) {
		throw new GiftError('Those gifts were not found.');
	}
	const claims = JSON.stringify({ sub: userId });
	const ids = sql.join(
		giftIds.map((id: string) => sql`${id}`),
		sql`, `,
	);
	try {
		await db.batch([
			db.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`),
			db.execute(
				sql`select app.mark_gifts_seen(${state.member.id}::uuid, array[${ids}]::uuid[])`,
			),
		]);
	} catch (err) {
		if (sqlState(err) === '42501') {
			throw new GiftError('Only the kid who got the points can do this.', 403);
		}
		throw err;
	}
}
