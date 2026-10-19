// The day a weekly chore is due (SB-71), as the screens word it. ISO numbering,
// as in `chores.due_weekday`: 1 = Monday ... 7 = Sunday. No server imports:
// this is bundled into the client.

import {
	type DueDayState,
	type IsoWeekday,
	isIsoWeekday,
} from '@chore/db/recurrence';

export type { DueDayState, IsoWeekday };
export { isIsoWeekday };

/** Monday first, as the week runs everywhere else in the app. */
export const WEEKDAYS: readonly { value: IsoWeekday; short: string }[] = [
	{ value: 1, short: 'Mon' },
	{ value: 2, short: 'Tue' },
	{ value: 3, short: 'Wed' },
	{ value: 4, short: 'Thu' },
	{ value: 5, short: 'Fri' },
	{ value: 6, short: 'Sat' },
	{ value: 7, short: 'Sun' },
];

/** "Thu" for 4. */
export const weekdayShort = (day: IsoWeekday) => WEEKDAYS[day - 1].short;

type Frequency = 'daily' | 'weekly' | 'weekends';

const FREQUENCY_LABELS: Record<Frequency, string> = {
	daily: 'Daily',
	weekly: 'Weekly',
	weekends: 'Weekends',
};

/**
 * How often a chore repeats, with its day when it has one: "Daily",
 * "Weekly", "Weekly · Thu". A day on anything but a weekly chore is ignored
 * (the database doesn't allow one).
 */
export function scheduleLabel(
	frequency: Frequency,
	dueWeekday: number | null | undefined,
): string {
	const base = FREQUENCY_LABELS[frequency];
	return frequency === 'weekly' && isIsoWeekday(dueWeekday)
		? `${base} · ${weekdayShort(dueWeekday)}`
		: base;
}

/**
 * The day a chore is due, relative to today: "Due today", "Due Thu", or
 * "Was due Thu" once that day has passed (it can still be done this week).
 */
export function dueDayText(state: DueDayState, day: IsoWeekday): string {
	if (state === 'today') return 'Due today';
	if (state === 'upcoming') return `Due ${weekdayShort(day)}`;
	return `Was due ${weekdayShort(day)}`;
}
