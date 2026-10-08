import { choreStages, chores, householdMembers } from '@chore/db';
import { and, asc, eq } from 'drizzle-orm';
import { type CreateChoreInput, createInputError } from '../chore-creator.ts';
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
 * Household rotations are created from the Eligibility step (SB-49), which
 * also writes the rotation and its members, so they are refused here.
 */
export async function createPersonalChore(
	actor: { householdId: string; userId: string | null },
	input: CreateChoreInput,
): Promise<{ id: string }> {
	const problem = createInputError(input);
	if (problem) throw new ChoreError(problem);
	if (input.kind !== 'personal') {
		throw new ChoreError(
			'Household rotations are saved from the Eligibility step.',
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
