import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * How often a chore resets. Each reset starts a new period, and each period
 * gets its own `chore_instances` row (see "Recurrence" in ../README.md and
 * `chorePeriodStart` in ../src/recurrence.ts):
 *
 * - `daily`: every day; the period is the day.
 * - `weekly`: once a week; the period is the ISO week, starting Monday.
 * - `weekends`: Saturdays and Sundays only; the period is the day, and there
 *   are no periods Monday to Friday.
 */
export const choreFrequency = pgEnum('chore_frequency', [
	'daily',
	'weekly',
	'weekends',
]);

export type ChoreFrequency = (typeof choreFrequency.enumValues)[number];
