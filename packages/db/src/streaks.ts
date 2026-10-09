import type { ChoreFrequency } from '../schema/chore-frequency.ts';
import { addDays, chorePeriodStart, localDate } from './recurrence.ts';

// Streak math (SB-28). Pure functions over what was due and what got done, so
// the server and UI share them and they're testable without a database.
// `householdStreaks()` in ./household-streaks.ts loads the rows and calls
// these. See "Streaks" in ../README.md.
//
// A day is a local calendar date (`YYYY-MM-DD`) in the household's time zone.
// A member's day qualifies when they completed every chore due to them that
// day. Days with nothing due, and days that only had skipped chores or a
// parent's exception, neither extend nor break a streak.

/** A chore due to a member on one day, and how it ended. */
export interface DueChore {
	memberId: string;
	/** The local date it's due: the day, or the last day of a weekly period. */
	date: string;
	/** `skipped` (a parent's Skip) doesn't count against the member. */
	outcome: 'done' | 'missed' | 'skipped';
}

/** A parent excusing a member for a whole day. */
export interface DayException {
	memberId: string;
	date: string;
}

export type DayStatus = 'qualified' | 'missed' | 'excused' | 'none';

export interface Streak {
	/** Consecutive qualifying days up to today (or yesterday if today isn't done yet). */
	days: number;
	/** Days inside the streak where an exception covered a miss ("1 exception"). */
	exceptions: number;
}

/** How far back a streak walk goes unless told otherwise. */
export const DEFAULT_STREAK_LOOKBACK_DAYS = 365;

/**
 * The day a chore is due for the period starting `periodStart`. Weekly
 * chores are due by Sunday; the others on their day.
 */
export function periodDueDate(
	frequency: ChoreFrequency,
	periodStart: string,
): string {
	return frequency === 'weekly' ? addDays(periodStart, 6) : periodStart;
}

/**
 * Every period of a chore whose due date falls in `from..to`, as
 * `[periodStart, dueDate]`. Periods that ended before `createdDate` (the
 * chore's local creation date) don't count.
 */
export function duePeriods(
	frequency: ChoreFrequency,
	createdDate: string,
	from: string,
	to: string,
): Array<[periodStart: string, dueDate: string]> {
	const out: Array<[string, string]> = [];
	for (let day = from; day <= to; day = addDays(day, 1)) {
		const start = chorePeriodStart(frequency, day);
		if (start === null) continue;
		const due = periodDueDate(frequency, start);
		// A weekly period is only yielded on its due day (the Sunday).
		if (due !== day || due < createdDate) continue;
		out.push([start, due]);
	}
	return out;
}

/** A member's status for one day: all done, something missed, excused, or nothing due. */
export function memberDayStatus(
	chores: readonly DueChore[],
	excepted = false,
): DayStatus {
	if (chores.some((c) => c.outcome === 'missed')) {
		return excepted ? 'excused' : 'missed';
	}
	return chores.some((c) => c.outcome === 'done') ? 'qualified' : 'none';
}

function groupByDate(chores: readonly DueChore[]): Map<string, DueChore[]> {
	const byDate = new Map<string, DueChore[]>();
	for (const chore of chores) {
		const day = byDate.get(chore.date);
		if (day) day.push(chore);
		else byDate.set(chore.date, [chore]);
	}
	return byDate;
}

/**
 * Walks back from `today` one day at a time. A miss today doesn't break the
 * streak (there's still time to do it); any earlier miss does. Excused and
 * empty days are stepped over. Excused days only count as exceptions when a
 * qualifying day lies further back, i.e. they sit inside the streak.
 */
function walk(
	statusOn: (date: string) => { status: DayStatus; excused: boolean },
	today: string,
	lookbackDays: number,
): Streak {
	let days = 0;
	let exceptions = 0;
	let pendingExceptions = 0;
	for (let i = 0; i <= lookbackDays; i++) {
		const { status, excused } = statusOn(addDays(today, -i));
		if (status === 'missed') {
			if (i === 0) continue;
			break;
		}
		if (status === 'qualified') {
			days++;
			exceptions += pendingExceptions + (excused ? 1 : 0);
			pendingExceptions = 0;
		} else if (excused) {
			pendingExceptions++;
		}
	}
	return { days, exceptions };
}

/**
 * A member's current streak: consecutive qualifying days ending today. An
 * exception turns a missed day into a neutral one.
 */
export function personalStreak(
	chores: readonly DueChore[],
	memberId: string,
	today: string,
	exceptions: readonly DayException[] = [],
	lookbackDays = DEFAULT_STREAK_LOOKBACK_DAYS,
): Streak {
	const byDate = groupByDate(chores.filter((c) => c.memberId === memberId));
	const excepted = new Set(
		exceptions.filter((e) => e.memberId === memberId).map((e) => e.date),
	);
	return walk(
		(date) => {
			const status = memberDayStatus(
				byDate.get(date) ?? [],
				excepted.has(date),
			);
			return { status, excused: status === 'excused' };
		},
		today,
		lookbackDays,
	);
}

/**
 * The household's current streak: consecutive days where every member
 * qualified, not counting members who were excused or had nothing due. A day
 * only extends it if at least one member qualified. `exceptions` counts the
 * excused misses inside the streak ("Family Streak · 5 Days · 1 exception").
 */
export function familyStreak(
	chores: readonly DueChore[],
	memberIds: readonly string[],
	today: string,
	exceptions: readonly DayException[] = [],
	lookbackDays = DEFAULT_STREAK_LOOKBACK_DAYS,
): Streak {
	const byDate = groupByDate(chores);
	const excepted = new Set(exceptions.map((e) => `${e.memberId}|${e.date}`));
	return walk(
		(date) => {
			const day = byDate.get(date) ?? [];
			const statuses = memberIds.map((memberId) =>
				memberDayStatus(
					day.filter((c) => c.memberId === memberId),
					excepted.has(`${memberId}|${date}`),
				),
			);
			const excused = statuses.includes('excused');
			if (statuses.includes('missed')) return { status: 'missed', excused };
			if (statuses.includes('qualified')) {
				return { status: 'qualified', excused };
			}
			return { status: excused ? 'excused' : 'none', excused };
		},
		today,
		lookbackDays,
	);
}

/** One chore's data, as `resolveDueChores()` needs it. */
export interface StreakChore {
	id: string;
	frequency: ChoreFrequency;
	/** `chores.assigned_member_id`; used when a period has no instance row. */
	assignedMemberId: string | null;
	createdAt: Date;
}

export interface StreakInstance {
	id: string;
	choreId: string;
	periodStart: string;
	assignedMemberId: string | null;
}

export interface StreakCompletion {
	instanceId: string;
	completedAt: Date;
}

/**
 * Works out what was due to whom, and how each ended, for every due date in
 * `from..today`:
 *
 * - A period is *done* if an open completion's local date (in `timeZone`)
 *   falls inside the period. Finishing it late doesn't count.
 * - It's *skipped* if its instance id is in `skippedInstanceIds`.
 * - Otherwise it's *missed*, including a period nobody touched (no instance
 *   row), which belongs to the chore's assignee. A rotation chore with no
 *   instance has no known turn-holder, so it's left out.
 * - Weekly chores are due on the period's Sunday, so they appear once that
 *   day arrives; weekends chores only on Saturdays and Sundays.
 */
export function resolveDueChores(input: {
	chores: readonly StreakChore[];
	instances: readonly StreakInstance[];
	completions: readonly StreakCompletion[];
	timeZone: string;
	from: string;
	today: string;
	skippedInstanceIds?: ReadonlySet<string>;
}): DueChore[] {
	const { timeZone, from, today } = input;
	const instanceByPeriod = new Map(
		input.instances.map((i) => [`${i.choreId}|${i.periodStart}`, i]),
	);
	const completedDates = new Map<string, string[]>();
	for (const c of input.completions) {
		const dates = completedDates.get(c.instanceId) ?? [];
		dates.push(localDate(timeZone, c.completedAt));
		completedDates.set(c.instanceId, dates);
	}
	const out: DueChore[] = [];
	for (const chore of input.chores) {
		const createdDate = localDate(timeZone, chore.createdAt);
		for (const [start, due] of duePeriods(
			chore.frequency,
			createdDate,
			from,
			today,
		)) {
			const instance = instanceByPeriod.get(`${chore.id}|${start}`);
			const memberId = instance
				? instance.assignedMemberId
				: chore.assignedMemberId;
			if (!memberId) continue;
			let outcome: DueChore['outcome'] = 'missed';
			if (instance && input.skippedInstanceIds?.has(instance.id)) {
				outcome = 'skipped';
			} else if (
				(completedDates.get(instance?.id ?? '') ?? []).some(
					(d) => d >= start && d <= due,
				)
			) {
				outcome = 'done';
			}
			out.push({ memberId, date: due, outcome });
		}
	}
	return out;
}
