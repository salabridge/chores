import type { ChoreFrequency } from '../schema/chore-frequency.ts';

/**
 * Period math for recurring chores. A chore resets by getting a new
 * `chore_instances` row per period, keyed by the period's first local date
 * (`period_start`). See "Recurrence" in ../README.md.
 *
 * Dates are local calendar dates as `YYYY-MM-DD` strings (what Drizzle returns
 * for a `date` column), never instants, so a period doesn't shift with the
 * server's time zone. Use `localDate()` to get "today" for a time zone.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(date: string): Date {
	const m = ISO_DATE.exec(date);
	if (!m) throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`);
	const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
	if (d.toISOString().slice(0, 10) !== date) {
		throw new RangeError(`Not a real date: "${date}"`);
	}
	return d;
}

function format(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** Adds `days` to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
	const d = parse(date);
	d.setUTCDate(d.getUTCDate() + days);
	return format(d);
}

/**
 * The `period_start` of the period containing `date`, or `null` when the
 * chore doesn't occur that day (`weekends` on a weekday):
 *
 * - `daily`: the date itself.
 * - `weekly`: the Monday of its ISO week.
 * - `weekends`: the date itself on Saturday or Sunday, otherwise `null`.
 */
export function chorePeriodStart(
	frequency: ChoreFrequency,
	date: string,
): string | null {
	const d = parse(date);
	const dow = d.getUTCDay(); // 0 = Sunday
	switch (frequency) {
		case 'daily':
			return date;
		case 'weekly':
			return addDays(date, -((dow + 6) % 7));
		case 'weekends':
			return dow === 0 || dow === 6 ? date : null;
	}
}

/**
 * The `period_start` of the period before the one starting at
 * `periodStart`. Streaks (SB-28) walk back with this to find missed periods.
 */
export function previousPeriodStart(
	frequency: ChoreFrequency,
	periodStart: string,
): string {
	switch (frequency) {
		case 'daily':
			return addDays(periodStart, -1);
		case 'weekly':
			return addDays(periodStart, -7);
		case 'weekends': {
			// Sunday -> Saturday; Saturday -> the Sunday before.
			const dow = parse(periodStart).getUTCDay();
			if (dow === 0) return addDays(periodStart, -1);
			if (dow === 6) return addDays(periodStart, -6);
			throw new RangeError(`${periodStart} isn't a weekend day`);
		}
	}
}

/** An ISO day of the week: 1 = Monday ... 7 = Sunday (`chores.due_weekday`). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Whether `value` is an ISO day of the week (an integer from 1 to 7). */
export function isIsoWeekday(value: unknown): value is IsoWeekday {
	return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 7;
}

/** The ISO day of the week of a `YYYY-MM-DD` date. */
export function isoWeekday(date: string): IsoWeekday {
	return (((parse(date).getUTCDay() + 6) % 7) + 1) as IsoWeekday;
}

/**
 * The local date a chore is due in the period starting at `periodStart`, or
 * `null` when it has no particular day (SB-71). Only a `weekly` chore with a
 * `due_weekday` has one: `periodStart` (the Monday) plus `dueWeekday - 1`.
 *
 * The period is still the whole ISO week: a chore due Thursday can be done
 * any day that week, and streaks and rotation turns don't look at this.
 */
export function choreDueDate(
	frequency: ChoreFrequency,
	periodStart: string,
	dueWeekday: number | null | undefined,
): string | null {
	if (frequency !== 'weekly' || dueWeekday == null) return null;
	if (!isIsoWeekday(dueWeekday)) {
		throw new RangeError(`Expected a weekday from 1 to 7, got ${dueWeekday}`);
	}
	return addDays(periodStart, dueWeekday - 1);
}

/**
 * How `today` relates to a chore's due date: `upcoming` before it, `today`
 * on it, `overdue` after it (still in the period, so still completable).
 */
export type DueDayState = 'upcoming' | 'today' | 'overdue';

export function dueDayState(today: string, dueDate: string): DueDayState {
	// YYYY-MM-DD strings sort as dates; parse() validates both.
	parse(today);
	parse(dueDate);
	if (today < dueDate) return 'upcoming';
	return today === dueDate ? 'today' : 'overdue';
}

/** The local calendar date (`YYYY-MM-DD`) at `at` in an IANA time zone. */
export function localDate(timeZone: string, at: Date = new Date()): string {
	// en-CA formats dates as YYYY-MM-DD.
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(at);
}

/** Whether `timeZone` is an IANA time zone name this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat('en-CA', { timeZone });
		return true;
	} catch {
		return false;
	}
}
