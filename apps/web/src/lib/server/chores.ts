import {
	choreCompletions,
	choreInstances,
	choreRotationMembers,
	choreRotations,
	choreStages,
	chores,
	householdMembers,
} from '@chore/db';
import { chorePeriodStart } from '@chore/db/recurrence';
import { nextEligibleMember } from '@chore/db/rotation';
import { and, asc, eq, inArray, isNull, notExists, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import {
	type CreateChoreInput,
	createInputError,
	type EditableChore,
	STALE_CHORE_MESSAGE,
	type UpdateChoreInput,
} from '../chore-creator.ts';
import {
	type CreateRotationChoreInput,
	rotationInputError,
} from '../chore-eligibility.ts';
import { db } from './drizzle.ts';
import { householdToday } from './household-today.ts';

// Reads and writes for the Chore Creator (SB-48). As in rotation-loops.ts, the
// web app is the table owner, so RLS doesn't apply: every query is scoped by
// the caller's own household, and callers must be parent-only.

/** A problem with what the parent sent, worded for the form. */
export class ChoreError extends Error {
	readonly status: 400 | 404 | 409;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(message: string, status: 400 | 404 | 409 = 400) {
		super(message);
		this.name = 'ChoreError';
		this.status = status;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const choreNotFound = () => new ChoreError('That chore was not found.', 404);

/** A saved chore with its stages' positions, for diffing an edit against. */
interface LoadedChore extends EditableChore {
	id: string;
	updatedAt: Date;
	stages: (EditableChore['stages'][number] & { position: number })[];
}

/**
 * A chore of this household that can be edited, with its stages in order, or
 * null. The one place the edit page and `updateChoreFromInput` look a chore
 * up, so a rule about which chores are editable (archived ones are not, SB-61)
 * is added to this query's `where`.
 */
export async function loadEditableChore(
	householdId: string,
	choreId: string,
): Promise<LoadedChore | null> {
	if (!UUID.test(choreId)) return null;
	const [chore] = await db
		.select()
		.from(chores)
		.where(and(eq(chores.id, choreId), eq(chores.householdId, householdId)));
	if (!chore) return null;
	const stages = await db
		.select({
			id: choreStages.id,
			title: choreStages.title,
			hint: choreStages.hint,
			position: choreStages.position,
		})
		.from(choreStages)
		.where(eq(choreStages.choreId, choreId))
		.orderBy(asc(choreStages.position));
	return {
		id: chore.id,
		title: chore.title,
		description: chore.description,
		type: chore.type,
		frequency: chore.frequency,
		points: chore.points,
		assignedMemberId: chore.assignedMemberId,
		updatedAt: chore.updatedAt,
		stages,
	};
}

/**
 * Stages sit above this while they are being reordered, so no two rows ever
 * share a position (`chore_stages_chore_id_position_key` is checked per row).
 */
const PARKED_POSITION = 1000;

/**
 * Saves changes to a chore. Kind can't change here, and rotation membership
 * stays in the Rotation Builder. Nothing already earned is rewritten:
 *
 * - Completions copy `points` when they happen, so new points only affect
 *   later completions.
 * - The current period's instance is left as it is; only the chore row changes.
 * - A new assignee takes over the current period's instance if it isn't done
 *   yet. A finished one stays credited to whoever did it.
 * - Stages are a diff by id: removed ones are deleted (their progress cascades),
 *   kept ones are updated in place so progress survives, new ones are inserted.
 *
 * It all goes in one batch (one transaction). The chore row is updated first,
 * only if `updated_at` still matches what the form loaded, and every later
 * statement is guarded on that update having taken effect, so a save that lost
 * a race changes nothing.
 */
export async function updateChoreFromInput(
	actor: { householdId: string },
	input: UpdateChoreInput,
): Promise<{ id: string }> {
	const problem = createInputError(input);
	if (problem) throw new ChoreError(problem);
	const loadedAt = new Date(String(input.updatedAt));
	if (Number.isNaN(loadedAt.getTime())) {
		throw new ChoreError('The chore is out of date. Reload and try again.');
	}

	const current = await loadEditableChore(
		actor.householdId,
		String(input.choreId),
	);
	if (!current) throw choreNotFound();
	if (input.kind !== current.type) {
		throw new ChoreError(
			"A chore's type can't change. Duplicate it as the other type instead.",
		);
	}
	if (current.updatedAt.getTime() !== loadedAt.getTime()) {
		throw new ChoreError(STALE_CHORE_MESSAGE, 409);
	}

	const savedIds = new Set(current.stages.map((s) => s.id));
	const keptIds = input.stages.flatMap((s) => (s.id ? [s.id] : []));
	if (
		keptIds.some((id) => !savedIds.has(id)) ||
		new Set(keptIds).size !== keptIds.length
	) {
		throw new ChoreError('The stages are out of date. Reload and try again.');
	}

	let assigneeId: string | null = null;
	if (current.type === 'personal') {
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
		assigneeId = assignee.id;
	}

	const choreId = current.id;
	const stamp = new Date(Math.max(Date.now(), loadedAt.getTime() + 1));
	// True only inside the transaction where the chore row below was updated.
	const saved = sql`exists (select 1 from ${chores} where ${chores.id} = ${choreId} and date_trunc('milliseconds', ${chores.updatedAt}) = ${stamp.toISOString()}::timestamptz)`;

	const queries: BatchItem<'pg'>[] = [
		db
			.update(chores)
			.set({
				title: input.title.trim(),
				description: input.note?.trim() || null,
				points: input.points,
				frequency: input.frequency,
				assignedMemberId: assigneeId,
				updatedAt: stamp,
			})
			.where(
				and(
					eq(chores.id, choreId),
					eq(chores.householdId, actor.householdId),
					// Postgres keeps microseconds and JS dates keep milliseconds.
					sql`date_trunc('milliseconds', ${chores.updatedAt}) = ${loadedAt.toISOString()}::timestamptz`,
				),
			)
			.returning({ id: chores.id }),
	];

	const removed = current.stages.filter((s) => !keptIds.includes(s.id));
	if (removed.length > 0) {
		queries.push(
			db.delete(choreStages).where(
				and(
					eq(choreStages.choreId, choreId),
					inArray(
						choreStages.id,
						removed.map((s) => s.id),
					),
					saved,
				),
			),
		);
	}

	// Kept stages that moved or were edited, with their new 1-based position.
	const savedById = new Map(current.stages.map((s) => [s.id, s]));
	const changed = input.stages.flatMap((s, i) => {
		const before = s.id ? savedById.get(s.id) : undefined;
		if (!s.id || !before) return [];
		const position = i + 1;
		const moved = before.position !== position;
		const edited = before.title !== s.title || before.hint !== s.hint;
		return moved || edited ? [{ id: s.id, stage: s, position, moved }] : [];
	});
	const stageWhere = (id: string) =>
		and(eq(choreStages.choreId, choreId), eq(choreStages.id, id), saved);
	// Park every stage that has to move first, so the final positions below
	// never collide with a row that hasn't moved yet.
	for (const c of changed.filter((c) => c.moved)) {
		queries.push(
			db
				.update(choreStages)
				.set({ position: PARKED_POSITION + c.position })
				.where(stageWhere(c.id)),
		);
	}
	for (const c of changed) {
		queries.push(
			db
				.update(choreStages)
				.set({
					position: c.position,
					title: c.stage.title.trim(),
					hint: c.stage.hint?.trim() || null,
				})
				.where(stageWhere(c.id)),
		);
	}
	input.stages.forEach((s, i) => {
		if (s.id) return;
		queries.push(
			db.execute(
				sql`insert into chore_stages (household_id, chore_id, position, title, hint, points)
					select ${actor.householdId}::uuid, ${choreId}::uuid, ${i + 1}, ${s.title.trim()}, ${s.hint?.trim() || null}, 0
					where ${saved}`,
			),
		);
	});

	// A new assignee picks up this period's instance, unless it's already done.
	if (current.type === 'personal' && assigneeId !== current.assignedMemberId) {
		const periodStart = chorePeriodStart(
			current.frequency,
			await householdToday(actor.householdId),
		);
		if (periodStart) {
			queries.push(
				db
					.update(choreInstances)
					.set({ assignedMemberId: assigneeId })
					.where(
						and(
							eq(choreInstances.choreId, choreId),
							eq(choreInstances.periodStart, periodStart),
							notExists(
								db
									.select({ id: choreCompletions.id })
									.from(choreCompletions)
									.where(
										and(
											eq(choreCompletions.instanceId, choreInstances.id),
											isNull(choreCompletions.reopenedAt),
										),
									),
							),
							saved,
						),
					),
			);
		}
	}

	const [first] = await db.batch(
		queries as [BatchItem<'pg'>, ...BatchItem<'pg'>[]],
	);
	// The guard matched nothing: someone saved between the check above and the batch.
	if ((first as unknown[]).length === 0) {
		throw new ChoreError(STALE_CHORE_MESSAGE, 409);
	}
	return { id: choreId };
}
