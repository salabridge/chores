import {
	choreRotationMembers,
	choreRotations,
	choreStages,
	chores,
	householdMembers,
} from '@chore/db';
import { nextEligibleMember } from '@chore/db/rotation';
import { and, asc, eq } from 'drizzle-orm';
import { type CreateChoreInput, createInputError } from '../chore-creator.ts';
import {
	type CreateRotationChoreInput,
	rotationInputError,
} from '../chore-eligibility.ts';
import { db } from './drizzle.ts';

// Reads and writes for the Chore Creator (SB-48). As in rotation-loops.ts, the
// web app is the table owner, so RLS doesn't apply: every query is scoped by
// the caller's own household, and callers must be parent-only.

/** A problem with what the parent sent, worded for the form. */
export class ChoreError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ChoreError';
	}
}

/** Everyone in the household, in the order they joined (the default rotation order). */
export async function listHouseholdMembers(householdId: string) {
	return db
		.select({ id: householdMembers.id, name: householdMembers.displayName })
		.from(householdMembers)
		.where(eq(householdMembers.householdId, householdId))
		.orderBy(asc(householdMembers.joinedAt), asc(householdMembers.id));
}

/**
 * Creates a personal chore and its stages in one batch (one transaction).
 * Household rotations go through `createRotationChore`, which also writes the
 * rotation and its members, so they are refused here.
 */
export async function createPersonalChore(
	actor: { householdId: string; userId: string | null },
	input: CreateChoreInput,
): Promise<{ id: string }> {
	const problem = createInputError(input);
	if (problem) throw new ChoreError(problem);
	if (input.kind !== 'personal') {
		throw new ChoreError(
			'Household rotations are saved from the Eligibility Setup panel.',
		);
	}

	const [assignee] = await db
		.select({ id: householdMembers.id })
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.id, String(input.assigneeId)),
				eq(householdMembers.householdId, actor.householdId),
			),
		);
	if (!assignee) throw new ChoreError('Choose a member of this household.');

	const id = crypto.randomUUID();
	const insertChore = db.insert(chores).values({
		id,
		householdId: actor.householdId,
		title: input.title.trim(),
		description: input.note?.trim() || null,
		type: 'personal',
		points: input.points,
		frequency: input.frequency,
		assignedMemberId: assignee.id,
		createdBy: actor.userId,
	});
	const insertStages = input.stages.map((s, i) =>
		db.insert(choreStages).values({
			householdId: actor.householdId,
			choreId: id,
			position: i + 1,
			title: s.title.trim(),
			hint: s.hint?.trim() || null,
			// Stages carry no points of their own; the chore's points are awarded once.
			points: 0,
		}),
	);
	await db.batch([insertChore, ...insertStages]);
	return { id };
}

/**
 * Creates a household rotation chore in one batch (one transaction): the
 * chore, its stages, the rotation row, and a row per household member.
 *
 * The database checks the rotation at commit (at least 2 eligible members,
 * unique positions, and the turn on an eligible member), and the rotation's
 * `current_member_id` foreign key is deferred, so the rows can go in this
 * order. The first eligible member in the order gets the first turn. The
 * scope is Whole Household unless someone is excluded.
 */
export async function createRotationChore(
	actor: { householdId: string; userId: string | null },
	input: CreateRotationChoreInput,
): Promise<{ id: string }> {
	const household = await listHouseholdMembers(actor.householdId);
	const problem = rotationInputError(
		input,
		household.map((m) => m.id),
	);
	if (problem) throw new ChoreError(problem);

	const { chore, members } = input;
	const ordered = members
		.map((m) => ({ ...m }))
		.sort((a, b) => a.position - b.position);
	const firstTurn = nextEligibleMember(ordered, null)?.member;
	if (!firstTurn) {
		throw new Error(
			'rotationInputError passed a rotation with no eligible member',
		);
	}

	const id = crypto.randomUUID();
	const insertChore = db.insert(chores).values({
		id,
		householdId: actor.householdId,
		title: chore.title.trim(),
		description: chore.note?.trim() || null,
		type: 'rotation',
		points: chore.points,
		frequency: chore.frequency,
		assignedMemberId: null,
		createdBy: actor.userId,
	});
	const insertStages = chore.stages.map((s, i) =>
		db.insert(choreStages).values({
			householdId: actor.householdId,
			choreId: id,
			position: i + 1,
			title: s.title.trim(),
			hint: s.hint?.trim() || null,
			points: 0,
		}),
	);
	const insertRotation = db.insert(choreRotations).values({
		choreId: id,
		householdId: actor.householdId,
		scope: ordered.every((m) => m.eligible)
			? 'whole_household'
			: 'eligible_subset',
		currentMemberId: firstTurn.memberId,
	});
	const insertMembers = db.insert(choreRotationMembers).values(
		ordered.map((m, i) => ({
			choreId: id,
			householdId: actor.householdId,
			memberId: m.memberId,
			position: i + 1,
			eligible: m.eligible,
			exclusionReason: m.eligible ? null : (m.exclusionReason?.trim() ?? null),
		})),
	);
	await db.batch([insertChore, ...insertStages, insertRotation, insertMembers]);
	return { id };
}
