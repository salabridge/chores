import { choreCompletions, chores, householdMembers } from '@chore/db';
import {
	and,
	asc,
	desc,
	eq,
	gte,
	isNull,
	ne,
	or,
	type SQL,
	sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
	FavourItem,
	FavourMember,
	FavourStatus,
	MemberFavours,
} from '../favour-approval.ts';
import { db } from './drizzle.ts';
import type { ProfileState } from './profile-state.ts';
import { sqlState, UUID } from './rotation-detail.ts';

// Favour approval (SB-79). When Mia does Leo's chore, the completion is
// `pending` until Leo (or a parent) decides; see "Favours need approval" in
// packages/db/README.md. The reads below are scoped by the caller's household
// (the web app talks to Postgres as the table owner, so RLS doesn't apply).
// The decisions go through `app.decide_favour` / `app.escalate_favour`, which
// authorize by the signed-in user (the JWT claims set in the same batch) and
// by `acting_as`: the kid whose profile is open, so a parent's session on a
// kid's profile counts as that kid, not as a parent.

/** A problem with the request, worded for the screen. */
export class FavourError extends Error {
	readonly status: 400 | 403 | 404 | 409;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(message: string, status: 400 | 403 | 404 | 409 = 400) {
		super(message);
		this.name = 'FavourError';
		this.status = status;
	}
}

/** Favours the doer did in the last week stay on their Today screen. */
const MY_FAVOURS_DAYS = 7;

const assignee = alias(householdMembers, 'assignee');
const doer = alias(householdMembers, 'doer');
const decider = alias(householdMembers, 'decider');

/** Favour rows (any status) matching `where`, with names and the chore. */
async function selectFavours(where: SQL | undefined, order: SQL[]) {
	return db
		.select({
			completionId: choreCompletions.id,
			choreId: choreCompletions.choreId,
			title: chores.title,
			points: choreCompletions.points,
			status: choreCompletions.approvalStatus,
			assigneeId: choreCompletions.memberId,
			assigneeName: assignee.displayName,
			doneById: choreCompletions.doneByMemberId,
			doneByName: doer.displayName,
			completedAt: choreCompletions.completedAt,
			escalatedAt: choreCompletions.escalatedAt,
			decidedById: choreCompletions.decidedByMemberId,
			decidedByName: decider.displayName,
			decidedAt: choreCompletions.decidedAt,
			// A declined favour can come back (a parent approving it, or the doer
			// asking a parent) only while nothing else completed the chore.
			superseded: sql<boolean>`exists (
				select 1 from chore_completions o
				where o.instance_id = ${choreCompletions.instanceId}
					and o.id <> ${choreCompletions.id}
					and o.reopened_at is null
					and o.approval_status <> 'declined'
			)`,
		})
		.from(choreCompletions)
		.innerJoin(chores, eq(chores.id, choreCompletions.choreId))
		.leftJoin(assignee, eq(assignee.id, choreCompletions.memberId))
		.leftJoin(doer, eq(doer.id, choreCompletions.doneByMemberId))
		.leftJoin(decider, eq(decider.id, choreCompletions.decidedByMemberId))
		.where(where)
		.orderBy(...order);
}

type FavourRow = Awaited<ReturnType<typeof selectFavours>>[number];

const member = (id: string | null, name: string | null): FavourMember | null =>
	id && name ? { memberId: id, name } : null;

/** One row as the screens see it. Exported for the tests. */
export function toFavourItem(row: FavourRow): FavourItem {
	const status = row.status as FavourStatus;
	const decidedByAssignee =
		row.decidedById !== null && row.decidedById === row.assigneeId;
	const canAskParent =
		row.escalatedAt === null &&
		(status === 'pending' ||
			(status === 'declined' && decidedByAssignee && !row.superseded));
	return {
		completionId: row.completionId,
		choreId: row.choreId,
		title: row.title,
		points: row.points,
		status,
		assignee: member(row.assigneeId, row.assigneeName),
		doneBy: member(row.doneById, row.doneByName),
		completedAt: row.completedAt.toISOString(),
		escalatedAt: row.escalatedAt?.toISOString() ?? null,
		decidedBy: member(row.decidedById, row.decidedByName),
		decidedAt: row.decidedAt?.toISOString() ?? null,
		decidedByAssignee,
		canAskParent,
	};
}

/**
 * The favours on `viewer`'s Today screen (SB-80): ones on their chores
 * waiting for their OK, and ones they did for others this past week.
 * `viewer` is the acting profile (`state.member`).
 */
export async function loadMemberFavours(
	viewer: { id: string; householdId: string },
	now: Date = new Date(),
): Promise<MemberFavours> {
	const since = new Date(now.getTime() - MY_FAVOURS_DAYS * 86_400_000);
	const household = eq(choreCompletions.householdId, viewer.householdId);
	const open = isNull(choreCompletions.reopenedAt);
	const [toApprove, mine] = await Promise.all([
		selectFavours(
			and(
				household,
				open,
				eq(choreCompletions.memberId, viewer.id),
				eq(choreCompletions.approvalStatus, 'pending'),
				isNull(choreCompletions.escalatedAt),
			),
			[asc(choreCompletions.completedAt)],
		),
		selectFavours(
			and(
				household,
				open,
				eq(choreCompletions.doneByMemberId, viewer.id),
				gte(choreCompletions.completedAt, since),
				// Favours that went through approval: still waiting, declined, or
				// decided. A parent recording them as the doer needed no approval.
				or(
					ne(choreCompletions.approvalStatus, 'approved'),
					sql`${choreCompletions.decidedAt} is not null`,
				),
			),
			[
				sql`(${choreCompletions.approvalStatus} = 'pending') desc`,
				desc(choreCompletions.completedAt),
			],
		),
	]);
	return {
		toApprove: toApprove.map(toFavourItem),
		mine: mine.map(toFavourItem),
	};
}

/**
 * Every favour waiting for a decision in the household, for the parent
 * Overview: ones the doer asked a parent about first, then the rest, oldest
 * first. A parent can decide any of them.
 */
export async function loadHouseholdFavours(
	householdId: string,
): Promise<FavourItem[]> {
	const rows = await selectFavours(
		and(
			eq(choreCompletions.householdId, householdId),
			isNull(choreCompletions.reopenedAt),
			eq(choreCompletions.approvalStatus, 'pending'),
		),
		[
			sql`${choreCompletions.escalatedAt} is null`,
			asc(choreCompletions.escalatedAt),
			asc(choreCompletions.completedAt),
		],
	);
	return rows.map(toFavourItem);
}

/** How many favours wait for a decision (the parent portal's nav badge). */
export async function countPendingFavours(householdId: string) {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(choreCompletions)
		.where(
			and(
				eq(choreCompletions.householdId, householdId),
				isNull(choreCompletions.reopenedAt),
				eq(choreCompletions.approvalStatus, 'pending'),
			),
		);
	return row?.count ?? 0;
}

export interface DecideResult {
	status: FavourStatus;
	/** False when it was already decided (a parent's decision stands). */
	changed: boolean;
	/** Points the doer got from this call. */
	points: number;
}

export interface AskParentResult {
	status: FavourStatus;
	changed: boolean;
}

/** The signed-in user's claims and the acting profile, for the batch. */
function authOf(state: ProfileState, completionId: string) {
	if (!UUID.test(completionId)) {
		throw new FavourError('That favour was not found.', 404);
	}
	const userId = state.actor.userId;
	if (!userId) throw new FavourError('Sign in again to continue.', 403);
	return {
		claims: JSON.stringify({ sub: userId }),
		// On a kid's profile the kid is acting, not the signed-in parent.
		actingAs: state.mode === 'kid' ? state.member.id : null,
	};
}

/**
 * Approves (`approve`) or declines a favour. The assignee decides favours on
 * their own chores (on their login, or their profile on the shared device);
 * a parent in their own view decides any of them, and their decision is
 * final. The doer can't decide their own.
 */
export async function decideFavour(
	state: ProfileState,
	completionId: string,
	approve: boolean,
): Promise<DecideResult> {
	const { claims, actingAs } = authOf(state, completionId);
	try {
		const [, decided] = await db.batch([
			db.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`),
			db.execute<{
				approval_status: FavourStatus;
				changed: boolean;
				points: number;
			}>(
				sql`select approval_status, changed, points from app.decide_favour(${completionId}::uuid, ${approve}, ${actingAs}::uuid)`,
			),
		]);
		const row = decided.rows[0];
		if (!row) throw new Error('decide_favour returned no row');
		return {
			status: row.approval_status,
			changed: row.changed,
			points: row.points,
		};
	} catch (err) {
		throw mapError(err, "You can't decide this favour.");
	}
}

/** The doer asks a parent to decide their favour ("Ask a parent"). */
export async function askParentToApprove(
	state: ProfileState,
	completionId: string,
): Promise<AskParentResult> {
	const { claims, actingAs } = authOf(state, completionId);
	try {
		const [, escalated] = await db.batch([
			db.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`),
			db.execute<{ approval_status: FavourStatus; changed: boolean }>(
				sql`select approval_status, changed from app.escalate_favour(${completionId}::uuid, ${actingAs}::uuid)`,
			),
		]);
		const row = escalated.rows[0];
		if (!row) throw new Error('escalate_favour returned no row');
		return { status: row.approval_status, changed: row.changed };
	} catch (err) {
		throw mapError(err, 'Only whoever did the chore can ask a parent.');
	}
}

/** Turns the database's custom errors into messages for the screen. */
function mapError(err: unknown, forbidden: string): unknown {
	switch (sqlState(err)) {
		case 'P0002':
			return new FavourError('That favour was not found.', 404);
		case 'CP005':
			return new FavourError('There is nothing to approve here.', 409);
		case 'CP006':
			return new FavourError(
				'A parent has been asked to decide this one.',
				409,
			);
		case 'CP007':
			return new FavourError(
				'The chore has been done again since, so this favour is closed.',
				409,
			);
		case 'CP008':
			return new FavourError('A parent already decided this one.', 409);
		case '42501':
			return new FavourError(forbidden, 403);
		default:
			return err;
	}
}
