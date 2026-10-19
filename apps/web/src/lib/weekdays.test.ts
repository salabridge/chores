import { describe, expect, it } from 'vitest';
import {
	dueDayText,
	scheduleLabel,
	WEEKDAYS,
	weekdayShort,
} from './weekdays.ts';

describe('weekdays', () => {
	it('runs Monday (1) to Sunday (7)', () => {
		expect(WEEKDAYS.map((d) => [d.value, d.short])).toEqual([
			[1, 'Mon'],
			[2, 'Tue'],
			[3, 'Wed'],
			[4, 'Thu'],
			[5, 'Fri'],
			[6, 'Sat'],
			[7, 'Sun'],
		]);
		expect(weekdayShort(4)).toBe('Thu');
	});

	it('labels the schedule with the due day of a weekly chore', () => {
		expect(scheduleLabel('weekly', 4)).toBe('Weekly · Thu');
		expect(scheduleLabel('weekly', null)).toBe('Weekly');
		expect(scheduleLabel('daily', null)).toBe('Daily');
		expect(scheduleLabel('weekends', undefined)).toBe('Weekends');
		// Only weekly chores have a day; anything else ignores one.
		expect(scheduleLabel('daily', 4)).toBe('Daily');
		expect(scheduleLabel('weekly', 0)).toBe('Weekly');
	});

	it('words the due day relative to today', () => {
		expect(dueDayText('today', 4)).toBe('Due today');
		expect(dueDayText('upcoming', 4)).toBe('Due Thu');
		expect(dueDayText('overdue', 4)).toBe('Was due Thu');
	});
});
