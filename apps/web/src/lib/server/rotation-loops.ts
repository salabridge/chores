import {
	choreRotationMembers,
	choreRotations,
	chores,
	householdMembers,
} from '@chore/db';
import { nextEligibleMember } from '@chore/db/rotation';
import { and, asc, eq } from 'drizzle-orm';
import {
	type RotationLoop,
	type SaveLoopInput,
	saveInputError,
} from '../rotation-loops.ts';
import { db } from './drizzle.ts';

// Reads and writes for the Rotation Loops Builder (SB-50). The web app talks
// to Postgres as the table owner, so RLS doesn't apply here: every query is
// scoped by `householdId` from the caller's own profile, and the callers
// (`rotations.remote.ts`, the page load) must be parent-only.

/** A problem with what the parent sent, worded for the card. */
export class RotationLoopError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RotationLoopError';
	}
}

/** Every rotation chore in the household, with its members in turn order. */
export async function listRotationLoops(
	householdId: string,
): Promise<RotationLoop[]> {
	const rows = await db
		.select({
			choreId: chores.id,
			title: chores.title,
			description: chores.description,
			points: chores.points,
			scope: choreRotations.scope,
			scopeLabel: choreRotations.scopeLabel,
			currentMemberId: choreRotations.currentMemberId,
		})
		.from(chores)
		.innerJoin(
			choreRotations,
			and(
				eq(choreRotations.choreId, chores.id),
				eq(choreRotations.householdId, chores.householdId),
			),
		)
		.where(
			and(eq(chores.householdId, householdId), eq(chores.type, 'rotation')),
		)
		.orderBy(asc(chores.createdAt), asc(chores.id));

	const members = await db
		.select({
			choreId: choreRotationMembers.choreId,
			memberId: choreRotationMembers.memberId,
			position: choreRotationMembers.position,
			eligible: choreRotationMembers.eligible,
			exclusionReason: choreRotationMembers.exclusionReason,
			name: householdMembers.displayName,
		})
		.from(choreRotationMembers)
		.innerJoin(
			householdMembers,
			eq(householdMembers.id, choreRotationMembers.memberId),
		)
		.where(eq(choreRotationMembers.householdId, householdId))
		.orderBy(asc(choreRotationMembers.position));

	return rows.map((row) => ({
		...row,
		members: members
			.filter((m) => m.choreId === row.choreId)
			.map(({ choreId: _choreId, ...m }) => m),
	}));
}

/** The loop's current rows, or a 404-shaped error if it isn't this household's. */
async function loadLoop(householdId: string, choreId: string) {
	const [loop] = (await listRotationLoops(householdId)).filter(
		(l) => l.choreId === choreId,
	);
	if (!loop) throw new RotationLoopError('That rotation loop was not found.');
	return loop;
}

/**
 * Saves a loop's scope, eligibility, exclusion reasons, and order. The member
 * list itself is fixed (adding someone to a loop belongs to the Chore
 * Creator); the input has to name exactly the members already in the loop.
 *
 * It all goes in one batch (a single transaction), because the database
 * checks "at least 2 eligible" and unique positions at commit, not per row.
 * If the member whose turn it is gets excluded, the database moves the turn
 * to the next eligible member.
 */
export async function saveRotationLoop(
	householdId: string,
	input: SaveLoopInput,
): Promise<void> {
	const loop = await loadLoop(householdId, input.choreId);

	const problem = saveInputError(loop, input);
	if (problem) throw new RotationLoopError(problem);

	const scopeLabel =
		input.scope === 'eligible_subset' ? (input.scopeLabel?.trim() ?? '') : '';

	const [updateRotation, ...updateMembers] = [
		db
			.update(choreRotations)
			.set({ scope: input.scope, scopeLabel: scopeLabel || null })
			.where(
				and(
					eq(choreRotations.choreId, input.choreId),
					eq(choreRotations.householdId, householdId),
				),
			),
		...input.members.map((m) =>
			db
				.update(choreRotationMembers)
				.set({
					position: m.position,
					eligible: m.eligible,
					exclusionReason: m.eligible
						? null
						: (m.exclusionReason?.trim() ?? null),
				})
				.where(
					and(
						eq(choreRotationMembers.choreId, input.choreId),
						eq(choreRotationMembers.householdId, householdId),
						eq(choreRotationMembers.memberId, m.memberId),
					),
				),
		),
	];
	await db.batch([updateRotation, ...updateMembers]);
}

/**
 * Hands the turn back to the first eligible member in the order, as if the
 * loop had just wrapped. Doesn't touch Done Last or award anything.
 */
export async function resetRotationLoop(
	householdId: string,
	choreId: string,
): Promise<void> {
	const loop = await loadLoop(householdId, choreId);
	const first = nextEligibleMember(loop.members, null);
	if (!first) {
		throw new RotationLoopError(
			'Nobody is eligible, so there is no turn to reset to.',
		);
	}
	await db
		.update(choreRotations)
		.set({ currentMemberId: first.member.memberId, turnStartedAt: new Date() })
		.where(
			and(
				eq(choreRotations.choreId, choreId),
				eq(choreRotations.householdId, householdId),
			),
		);
}
