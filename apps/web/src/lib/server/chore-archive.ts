import { choreCompletions, chores } from '@chore/db';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from './drizzle.ts';

// Archive, restore and delete for chores (SB-61). As with the other web-side
// modules, the web app talks to Postgres as the table owner, so RLS doesn't
// apply: every statement is scoped by the household of the caller's own
// profile, and the remote functions that call these require a parent.
//
// Archiving is the normal way to remove a chore: the row stays, with all its
// completions, ledger rows and rotation state, and `archived_at` hides it from
// every read that exists for doing chores. Deleting is only for a chore nobody
// ever completed.

/** A problem with the request, worded for the form. */
export class ChoreArchiveError extends Error {
	readonly status: 400 | 404 | 409;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(message: string, status: 400 | 404 | 409 = 400) {
		super(message);
		this.name = 'ChoreArchiveError';
		this.status = status;
	}
}

const notFound = () => new ChoreArchiveError('That chore was not found.', 404);

const hasBeenCompleted = () =>
	new ChoreArchiveError(
		'This chore has been completed, so it can’t be deleted. Archive it instead.',
		409,
	);

/** Whether `err` (or a wrapped cause) is a foreign key violation, SQLSTATE 23503. */
function isForeignKeyViolation(err: unknown): boolean {
	let e: unknown = err;
	while (e instanceof Error) {
		if ((e as { code?: unknown }).code === '23503') return true;
		e = e.cause;
	}
	return false;
}

/** The UPDATE that archives a chore, unexecuted so it can join a batch. */
export const archiveStatement = (householdId: string, choreId: string) =>
	db
		.update(chores)
		.set({ archivedAt: new Date() })
		.where(
			and(
				eq(chores.id, choreId),
				eq(chores.householdId, householdId),
				isNull(chores.archivedAt),
			),
		)
		.returning({ id: chores.id });

/**
 * Archives a chore as the FIRST statement of a batch and fails the whole batch
 * (a transaction) when it matches nothing, so whatever follows is written only
 * if the chore was archived by this very statement. The count is zero when the
 * chore is missing, foreign or already archived, and `1 / 0` raises
 * division_by_zero (22012). A plain UPDATE that matches no row doesn't fail
 * a batch, and a read beforehand can go stale before the batch commits.
 */
export const archiveOrFailStatement = (householdId: string, choreId: string) =>
	db.execute(sql`
		with archived as (
			update chores set archived_at = now()
			where id = ${choreId}::uuid
				and household_id = ${householdId}::uuid
				and archived_at is null
			returning id
		)
		select 1 / (select count(*) from archived) as archived`);

/** Whether a batch failed because `archiveOrFailStatement` matched no chore. */
export const isArchiveMiss = (e: unknown): boolean => {
	for (let err = e as { code?: unknown; cause?: unknown } | undefined; err; ) {
		if (err.code === '22012') return true;
		err = err.cause as typeof err;
	}
	return false;
};

/** Hides a chore everywhere it's done. Its history and points are untouched. */
export async function archiveChore(
	householdId: string,
	choreId: string,
): Promise<void> {
	const archived = await archiveStatement(householdId, choreId);
	if (archived.length === 0) throw notFound();
}

/**
 * Brings an archived chore back. It picks up from the next period: periods
 * that passed while it was archived aren't backfilled, because instances are
 * only created when someone opens a period.
 */
export async function restoreChore(
	householdId: string,
	choreId: string,
): Promise<void> {
	const restored = await db
		.update(chores)
		.set({ archivedAt: null })
		.where(
			and(
				eq(chores.id, choreId),
				eq(chores.householdId, householdId),
				isNotNull(chores.archivedAt),
			),
		)
		.returning({ id: chores.id });
	if (restored.length === 0) throw notFound();
}

/**
 * Permanently deletes a chore that has never been completed (the "made a
 * mistake" escape hatch). Two checks, because a statement only sees what was
 * committed when it started:
 *
 * - The DELETE's own `not exists (completions)` skips a chore that already has
 *   one, without raising.
 * - The database enforces the rest. `chore_completions` references
 *   `chore_instances` and `chores` with NO ACTION (migration 0019), so a
 *   completion that commits while the DELETE runs makes it fail with 23503
 *   instead of cascading away.
 *
 * Either way a completed chore is refused with the same message. When nothing
 * is deleted, a second read tells "doesn't exist" from "has been completed".
 */
export async function deleteChore(
	householdId: string,
	choreId: string,
): Promise<void> {
	let deleted: { id: string }[];
	try {
		deleted = await db
			.delete(chores)
			.where(
				and(
					eq(chores.id, choreId),
					eq(chores.householdId, householdId),
					sql`not exists (select 1 from ${choreCompletions} where ${choreCompletions.choreId} = ${chores.id})`,
				),
			)
			.returning({ id: chores.id });
	} catch (e) {
		if (isForeignKeyViolation(e)) throw hasBeenCompleted();
		throw e;
	}
	if (deleted.length > 0) return;

	const [chore] = await db
		.select({ id: chores.id })
		.from(chores)
		.where(and(eq(chores.id, choreId), eq(chores.householdId, householdId)));
	if (!chore) throw notFound();
	throw hasBeenCompleted();
}
