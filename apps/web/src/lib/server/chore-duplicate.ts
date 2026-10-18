import { choreRotations, choreStages, chores } from '@chore/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { DuplicateSource } from '../chore-duplicate.ts';
import { db } from './drizzle.ts';

// Reads the chore that "Duplicate as…" (SB-64) copies. As in chore-archive.ts,
// the web app is the table owner, so RLS doesn't apply: the read is scoped by
// the caller's household, and callers must be parent-only.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The chore to copy, or null when it doesn't exist, belongs to another
 * household, or is archived (an archived chore is gone from the parent's
 * point of view, so there is nothing to switch). A malformed id is also null
 * rather than a Postgres error.
 */
export async function loadDuplicateSource(
	householdId: string,
	choreId: string,
): Promise<DuplicateSource | null> {
	if (!UUID.test(choreId)) return null;
	const [chore] = await db
		.select()
		.from(chores)
		.where(
			and(
				eq(chores.id, choreId),
				eq(chores.householdId, householdId),
				isNull(chores.archivedAt),
			),
		);
	if (!chore) return null;

	const stages = await db
		.select({ title: choreStages.title, hint: choreStages.hint })
		.from(choreStages)
		.where(eq(choreStages.choreId, chore.id))
		.orderBy(asc(choreStages.position));

	let currentTurnMemberId: string | null = null;
	if (chore.type === 'rotation') {
		const [rotation] = await db
			.select({ currentMemberId: choreRotations.currentMemberId })
			.from(choreRotations)
			.where(eq(choreRotations.choreId, chore.id));
		currentTurnMemberId = rotation?.currentMemberId ?? null;
	}

	return {
		id: chore.id,
		title: chore.title,
		note: chore.description,
		kind: chore.type,
		frequency: chore.frequency,
		dueWeekday: chore.dueWeekday,
		points: chore.points,
		stages,
		assigneeId: chore.assignedMemberId,
		currentTurnMemberId,
	};
}
