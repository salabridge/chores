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

/** Hides a chore everywhere it's done. Its history and points are untouched. */
export async function archiveChore(
	householdId: string,
	choreId: string,
): Promise<void> {
	const archived = await db
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
 * mistake" escape hatch). The no-completions check is part of the DELETE
 * statement itself, not a read beforehand, so a completion recorded in
 * between can't slip past it. When nothing is deleted, a second read tells
 * "doesn't exist" from "has been completed" for the message.
 */
export async function deleteChore(
	householdId: string,
	choreId: string,
): Promise<void> {
	const deleted = await db
		.delete(chores)
		.where(
			and(
				eq(chores.id, choreId),
				eq(chores.householdId, householdId),
				sql`not exists (select 1 from ${choreCompletions} where ${choreCompletions.choreId} = ${chores.id})`,
			),
		)
		.returning({ id: chores.id });
	if (deleted.length > 0) return;

	const [chore] = await db
		.select({ id: chores.id })
		.from(chores)
		.where(and(eq(chores.id, choreId), eq(chores.householdId, householdId)));
	if (!chore) throw notFound();
	throw new ChoreArchiveError(
		'This chore has been completed, so it can’t be deleted. Archive it instead.',
		409,
	);
}
