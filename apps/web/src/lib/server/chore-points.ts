import { choreStages, chores } from '@chore/db';
import { getTableColumns, sql } from 'drizzle-orm';

/**
 * What a chore can earn in all: its own points (a bonus for finishing it) plus
 * every stage's. This is the number the app shows as "N pts"; the database
 * pays the stages as they're finished and the chore's own points at the end.
 */
export const choreTotalPoints = sql<number>`(${chores.points} + coalesce((select sum(${choreStages.points}) from ${choreStages} where ${choreStages.choreId} = ${chores.id}), 0))::int`;

/** Every `chores` column, with `points` replaced by the chore's total (see `choreTotalPoints`). */
export const choreColumnsWithTotalPoints = {
	...getTableColumns(chores),
	points: choreTotalPoints.as('points'),
};
