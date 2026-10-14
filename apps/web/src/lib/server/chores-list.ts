import {
	choreCompletions,
	choreRotationMembers,
	choreRotations,
	choreStages,
	chores,
	householdMembers,
} from '@chore/db';
import { asc, eq, sql } from 'drizzle-orm';
import type { ChoreListItem, ChoreListMember } from '../chores-list.ts';
import { db } from './drizzle.ts';

// The read behind the parent chores list (SB-62). As with the other web-side
// modules, the web app talks to Postgres as the table owner, so RLS doesn't
// apply: every query is scoped by the caller's household, and the page load
// must be parent-only.

export interface ChoresList {
	members: ChoreListMember[];
	chores: ChoreListItem[];
}

/**
 * Every chore in the household, archived ones included (the page filters), in
 * four queries that run together. Stage count and "ever completed" are
 * subqueries on the chore rows, not a row per stage or completion.
 */
export async function loadChoresList(householdId: string): Promise<ChoresList> {
	const [choreRows, rotationRows, loopRows, members] = await Promise.all([
		db
			.select({
				id: chores.id,
				title: chores.title,
				type: chores.type,
				frequency: chores.frequency,
				points: chores.points,
				assignedMemberId: chores.assignedMemberId,
				archivedAt: chores.archivedAt,
				stageCount: sql<number>`(select count(*)::int from ${choreStages} where ${choreStages.choreId} = ${chores.id})`,
				completed: sql<boolean>`exists (select 1 from ${choreCompletions} where ${choreCompletions.choreId} = ${chores.id})`,
			})
			.from(chores)
			.where(eq(chores.householdId, householdId))
			.orderBy(asc(chores.createdAt), asc(chores.id)),
		db
			.select({
				choreId: choreRotations.choreId,
				currentMemberId: choreRotations.currentMemberId,
			})
			.from(choreRotations)
			.where(eq(choreRotations.householdId, householdId)),
		db
			.select({
				choreId: choreRotationMembers.choreId,
				memberId: choreRotationMembers.memberId,
				position: choreRotationMembers.position,
				eligible: choreRotationMembers.eligible,
			})
			.from(choreRotationMembers)
			.where(eq(choreRotationMembers.householdId, householdId))
			.orderBy(asc(choreRotationMembers.position)),
		db
			.select({
				id: householdMembers.id,
				name: householdMembers.displayName,
				role: householdMembers.role,
			})
			.from(householdMembers)
			.where(eq(householdMembers.householdId, householdId)),
	]);

	const current = new Map(
		rotationRows.map((r) => [r.choreId, r.currentMemberId]),
	);
	return {
		members,
		chores: choreRows.map(({ archivedAt, ...c }) => ({
			...c,
			currentMemberId: current.get(c.id) ?? null,
			loop: loopRows
				.filter((m) => m.choreId === c.id)
				.map(({ choreId: _choreId, ...m }) => m),
			archived: archivedAt !== null,
		})),
	};
}
