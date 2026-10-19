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
import { and, asc, eq, inArray, isNull, ne, notExists, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import {
	type CreateChoreInput,
	createInputError,
	dueWeekdayFor,
	type EditableChore,
	FREQUENCY_LOCKED_MESSAGE,
	STALE_CHORE_MESSAGE,
	type UpdateChoreInput,
} from '../chore-creator.ts';
import {
	type CreateRotationChoreInput,
	rotationInputError,
} from '../chore-eligibility.ts';
import { archiveOrFailStatement, isArchiveMiss } from './chore-archive.ts';
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The statement that archives the chore a "Duplicate as…" copy replaces (SB-64).
 * It goes FIRST in the create's batch and fails the batch when it archives
 * nothing, so the batch is the source of truth: if the original is archived or
 * deleted after the read here, nothing is written. The read only gives an
 * early, friendly error. The statement is wrapped because an async function
 * would await it, and a query builder runs when awaited.
 */
async function archiveOriginal(householdId: string, sourceId: string) {
	const [source] = UUID.test(sourceId)
		? await db
				.select({ id: chores.id })
				.from(chores)
				.where(
					and(
						eq(chores.id, sourceId),
						eq(chores.householdId, householdId),
						isNull(chores.archivedAt),
					),
				)
		: [];
	if (!source) throw originalGone();
	return { statement: archiveOrFailStatement(householdId, source.id) };
}

const originalGone = () =>
	new ChoreError(
		'The chore you are replacing was not found, or is already archived.',
	);

/** Runs the create's batch, turning a missed archive into the "original is gone" message. */
async function runBatch(
	run: () => Promise<unknown>,
	archive: object | null,
): Promise<void> {
	try {
		await run();
	} catch (e) {
		if (archive && isArchiveMiss(e)) throw originalGone();
		throw e;
	}
}

/**
 * Creates a personal chore and its stages in one batch (one transaction), plus
 * the archive of `input.archiveSourceId` when a duplicate replaces its original.
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

	const archive = input.archiveSourceId
		? await archiveOriginal(actor.householdId, input.archiveSourceId)
		: null;

	const id = crypto.randomUUID();
	const insertChore = db.insert(chores).values({
		id,
		householdId: actor.householdId,
		title: input.title.trim(),
		description: input.note?.trim() || null,
		type: 'personal',
		points: input.points,
		frequency: input.frequency,
		dueWeekday: dueWeekdayFor(input.frequency, input.dueWeekday),
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
	await runBatch(
		() =>
			archive
				? db.batch([archive.statement, insertChore, ...insertStages])
				: db.batch([insertChore, ...insertStages]),
		archive,
	);
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
 * scope is Whole Household unless someone is excluded. As for a personal
 * chore, `input.archiveSourceId` archives the original in the same batch.
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

	const archive = input.archiveSourceId
		? await archiveOriginal(actor.householdId, input.archiveSourceId)
		: null;

	const id = crypto.randomUUID();
	const insertChore = db.insert(chores).values({
		id,
		householdId: actor.householdId,
		title: chore.title.trim(),
		description: chore.note?.trim() || null,
		type: 'rotation',
		points: chore.points,
		frequency: chore.frequency,
		dueWeekday: dueWeekdayFor(chore.frequency, chore.dueWeekday),
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
	await runBatch(
		() =>
			archive
				? db.batch([
						archive.statement,
						insertChore,
						...insertStages,
						insertRotation,
						insertMembers,
					])
				: db.batch([
						insertChore,
						...insertStages,
						insertRotation,
						insertMembers,
					]),
		archive,
	);
	return { id };
}

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
		dueWeekday: chore.dueWeekday,
		points: chore.points,
		assignedMemberId: chore.assignedMemberId,
		updatedAt: chore.updatedAt,
		stages,
	};
}

/**
 * This period's `period_start` for the chore's current frequency (the
 * household's own day, as Today uses), or null when it isn't due today.
 */
async function currentPeriodStart(
	householdId: string,
	frequency: EditableChore['frequency'],
): Promise<string | null> {
	return chorePeriodStart(frequency, await householdToday(householdId));
}

/**
 * Whether the chore has an open completion in the current period. Changing
 * how often a chore repeats re-keys its periods, which would make a finished
 * chore look undone, so the edit page locks frequency while this is true.
 * (A proper fix is SB-65.)
 */
export async function isDoneThisPeriod(
	householdId: string,
	choreId: string,
	frequency: EditableChore['frequency'],
): Promise<boolean> {
	const periodStart = await currentPeriodStart(householdId, frequency);
	if (!periodStart) return false;
	const rows = await db
		.select({ id: choreCompletions.id })
		.from(choreCompletions)
		.innerJoin(
			choreInstances,
			eq(choreInstances.id, choreCompletions.instanceId),
		)
		.where(
			and(
				eq(choreInstances.choreId, choreId),
				eq(choreInstances.periodStart, periodStart),
				isNull(choreCompletions.reopenedAt),
				// A pending favour (SB-79) may still be approved; a declined one
				// left the chore open.
				ne(choreCompletions.approvalStatus, 'declined'),
			),
		)
		.limit(1);
	return rows.length > 0;
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

	// Refuse the whole save, not just the frequency, when the chore is done.
	const frequencyChanged = input.frequency !== current.frequency;
	if (
		frequencyChanged &&
		(await isDoneThisPeriod(actor.householdId, current.id, current.frequency))
	) {
		throw new ChoreError(FREQUENCY_LOCKED_MESSAGE, 409);
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
	const periodStart = await currentPeriodStart(
		actor.householdId,
		current.frequency,
	);
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
				// Only weekly chores keep a due day; switching away clears it.
				dueWeekday: dueWeekdayFor(input.frequency, input.dueWeekday),
				assignedMemberId: assigneeId,
				updatedAt: stamp,
			})
			.where(
				and(
					eq(chores.id, choreId),
					eq(chores.householdId, actor.householdId),
					// Postgres keeps microseconds and JS dates keep milliseconds.
					sql`date_trunc('milliseconds', ${chores.updatedAt}) = ${loadedAt.toISOString()}::timestamptz`,
					// Re-checked here so a completion landing after the check above
					// can't slip a frequency change through.
					frequencyChanged && periodStart
						? sql`not exists (select 1 from chore_completions c join chore_instances i on i.id = c.instance_id where i.chore_id = ${choreId} and i.period_start = ${periodStart}::date and c.reopened_at is null and c.approval_status <> 'declined')`
						: undefined,
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
											ne(choreCompletions.approvalStatus, 'declined'),
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
		if (frequencyChanged) {
			// Either guard may have fired; the chore row tells them apart.
			const now = await loadEditableChore(actor.householdId, choreId);
			if (now && now.updatedAt.getTime() === loadedAt.getTime()) {
				throw new ChoreError(FREQUENCY_LOCKED_MESSAGE, 409);
			}
		}
		throw new ChoreError(STALE_CHORE_MESSAGE, 409);
	}
	return { id: choreId };
}
