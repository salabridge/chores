import { describe, expect, it } from 'vitest';
import {
	buildCalendar,
	CALENDAR_LOOKBACK_DAYS,
	CALENDAR_WINDOW_DAYS,
	type CalendarChore,
	type CalendarInput,
	choreOccurrences,
	escapeText,
	foldLine,
	zonedTimeToUtc,
} from './calendar.ts';

// 2026-11-22 is a Sunday.
const TODAY = '2026-11-22';
const NOW = new Date('2026-11-22T20:00:00Z');

const chore = (overrides: Partial<CalendarChore> = {}): CalendarChore => ({
	id: 'chore-1',
	title: 'Make bed',
	description: null,
	type: 'personal',
	frequency: 'daily',
	dueTime: null,
	dueLabel: null,
	dueWeekday: null,
	assignedMemberId: 'mia',
	updatedAt: NOW,
	...overrides,
});

const input = (overrides: Partial<CalendarInput> = {}): CalendarInput => ({
	householdName: 'The Smiths',
	timeZone: 'America/Chicago',
	today: TODAY,
	now: NOW,
	chores: [chore()],
	rotations: [],
	instances: [],
	memberNames: new Map([
		['mia', 'Mia'],
		['leo', 'Leo'],
		['sam', 'Sam'],
	]),
	...overrides,
});

describe('escapeText', () => {
	it('escapes backslashes, semicolons, commas and newlines', () => {
		expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
	});
});

describe('foldLine', () => {
	it('leaves short lines alone', () => {
		expect(foldLine('SUMMARY:Make bed')).toBe('SUMMARY:Make bed');
	});

	it('folds long lines to 75 octets and unfolds back to the original', () => {
		const line = `SUMMARY:${'word '.repeat(40)}`;
		const folded = foldLine(line);
		const parts = folded.split('\r\n');
		expect(parts.length).toBeGreaterThan(1);
		for (const part of parts) {
			expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
		}
		expect(folded.replaceAll('\r\n ', '')).toBe(line);
	});

	it('never splits a multi-byte character', () => {
		const line = `SUMMARY:${'é—\u{1f9f9}'.repeat(30)}`;
		const folded = foldLine(line);
		for (const part of folded.split('\r\n')) {
			expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
		}
		expect(folded.replaceAll('\r\n ', '')).toBe(line);
	});
});

describe('zonedTimeToUtc', () => {
	it('uses the standard-time offset in winter', () => {
		expect(
			zonedTimeToUtc('2026-11-22', '19:00:00', 'America/Chicago').toISOString(),
		).toBe('2026-11-23T01:00:00.000Z');
	});

	it('uses the daylight-time offset in summer', () => {
		expect(
			zonedTimeToUtc('2026-07-01', '19:00', 'America/Chicago').toISOString(),
		).toBe('2026-07-02T00:00:00.000Z');
	});

	it('is the same clock time in UTC', () => {
		expect(zonedTimeToUtc('2026-11-22', '08:30', 'UTC').toISOString()).toBe(
			'2026-11-22T08:30:00.000Z',
		);
	});
});

describe('choreOccurrences', () => {
	const datesOf = (i: CalendarInput) => choreOccurrences(i).map((o) => o.date);

	it('lists a daily chore every day from a week back to the end of the window', () => {
		const dates = datesOf(input());
		expect(dates).toHaveLength(
			CALENDAR_LOOKBACK_DAYS + CALENDAR_WINDOW_DAYS + 1,
		);
		expect(dates[0]).toBe('2026-11-15');
		expect(dates.at(-1)).toBe('2027-01-17');
	});

	it('lists a weekends chore on Saturdays and Sundays only', () => {
		const dates = datesOf(
			input({ chores: [chore({ frequency: 'weekends' })] }),
		);
		expect(dates.slice(0, 4)).toEqual([
			'2026-11-15',
			'2026-11-21',
			'2026-11-22',
			'2026-11-28',
		]);
	});

	it('puts a weekly chore on its due weekday', () => {
		const out = choreOccurrences(
			input({ chores: [chore({ frequency: 'weekly', dueWeekday: 4 })] }),
		);
		// Thursdays. 2026-11-12 is before the lookback starts (11-15), so it's left out.
		expect(out.slice(0, 3).map((o) => o.date)).toEqual([
			'2026-11-19',
			'2026-11-26',
			'2026-12-03',
		]);
		expect(out.every((o) => o.days === 1)).toBe(true);
	});

	it('spans a weekly chore with no due day across its whole week', () => {
		const out = choreOccurrences(
			input({ chores: [chore({ frequency: 'weekly' })] }),
		);
		// The week of 11-09 runs through Sunday 11-15, the first day of the
		// lookback, so it still overlaps the window.
		expect(out[0]).toMatchObject({ date: '2026-11-09', days: 7 });
		expect(out[1]).toMatchObject({ date: '2026-11-16', days: 7 });
	});

	it('gives a personal chore the person it was fixed to that period', () => {
		const out = choreOccurrences(
			input({
				instances: [
					{ choreId: 'chore-1', periodStart: TODAY, assignedMemberId: 'leo' },
				],
			}),
		);
		expect(out.find((o) => o.date === TODAY)?.assigneeId).toBe('leo');
		expect(out.find((o) => o.date === '2026-11-23')?.assigneeId).toBe('mia');
	});

	describe('rotations', () => {
		const rotation = {
			choreId: 'chore-1',
			currentMemberId: 'leo',
			members: [
				{ memberId: 'mia', position: 1, eligible: true },
				{ memberId: 'leo', position: 2, eligible: true },
				{ memberId: 'sam', position: 3, eligible: true },
			],
		};
		const rotating = (overrides: Partial<CalendarInput> = {}) =>
			input({
				chores: [chore({ type: 'rotation', assignedMemberId: null })],
				rotations: [rotation],
				...overrides,
			});
		const assignees = (i: CalendarInput, from: string, count: number) =>
			choreOccurrences(i)
				.filter((o) => o.date >= from)
				.slice(0, count)
				.map((o) => o.assigneeId);

		it('projects the active turn, then each hand-off in loop order', () => {
			expect(assignees(rotating(), TODAY, 5)).toEqual([
				'leo',
				'sam',
				'mia',
				'leo',
				'sam',
			]);
		});

		it('gives the active turn to the current week of a weekly chore, even after its due day', () => {
			// Today is Sunday 11-22; the week of 11-16 was due Thursday 11-19 but
			// can still be done, so it's Leo's, and the next week is Sam's.
			const i = rotating({
				chores: [
					chore({
						type: 'rotation',
						frequency: 'weekly',
						dueWeekday: 4,
						assignedMemberId: null,
					}),
				],
			});
			const weeks = choreOccurrences(i).filter(
				(o) => o.periodStart >= '2026-11-16',
			);
			expect(
				weeks.slice(0, 3).map((o) => [o.periodStart, o.assigneeId]),
			).toEqual([
				['2026-11-16', 'leo'],
				['2026-11-23', 'sam'],
				['2026-11-30', 'mia'],
			]);
		});

		it('skips ineligible members', () => {
			const i = rotating({
				rotations: [
					{
						...rotation,
						members: rotation.members.map((m) =>
							m.memberId === 'sam' ? { ...m, eligible: false } : m,
						),
					},
				],
			});
			expect(assignees(i, TODAY, 4)).toEqual(['leo', 'mia', 'leo', 'mia']);
		});

		it('keeps a period that already has its turn fixed, and projects after it', () => {
			// Today's turn went to Mia and she has done it, so the rotation has
			// already moved on to Leo for tomorrow.
			const i = rotating({
				instances: [
					{ choreId: 'chore-1', periodStart: TODAY, assignedMemberId: 'mia' },
				],
			});
			expect(assignees(i, TODAY, 3)).toEqual(['mia', 'leo', 'sam']);
		});

		it('names nobody for past periods nobody touched', () => {
			const past = choreOccurrences(rotating()).filter((o) => o.date < TODAY);
			expect(past.length).toBeGreaterThan(0);
			expect(past.every((o) => o.assigneeId === null)).toBe(true);
		});

		it('names nobody when the rotation has no eligible member', () => {
			const i = rotating({
				rotations: [
					{
						...rotation,
						members: rotation.members.map((m) => ({ ...m, eligible: false })),
					},
				],
			});
			expect(assignees(i, TODAY, 2)).toEqual([null, null]);
		});
	});
});

describe('buildCalendar', () => {
	const lines = (i: CalendarInput) =>
		buildCalendar(i).replaceAll('\r\n ', '').split('\r\n');

	it('is a CRLF-terminated VCALENDAR named for the household', () => {
		const text = buildCalendar(input({ chores: [] }));
		expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(text).not.toMatch(/[^\r]\n/);
		expect(text).toContain('X-WR-CALNAME:The Smiths chores\r\n');
		expect(text).toContain('X-WR-TIMEZONE:America/Chicago\r\n');
		expect(text).not.toContain('BEGIN:VEVENT');
	});

	it('writes the chore name and the person in the summary', () => {
		const out = lines(input());
		expect(out).toContain('SUMMARY:Make bed — Mia');
		expect(out).toContain('DESCRIPTION:Assigned to: Mia');
	});

	it('writes just the chore name when nobody has it', () => {
		const out = lines(input({ chores: [chore({ assignedMemberId: null })] }));
		expect(out).toContain('SUMMARY:Make bed');
		expect(out).toContain('DESCRIPTION:Not assigned to anyone yet');
	});

	it('writes a chore with no time as a free all-day entry', () => {
		const out = lines(input());
		expect(out).toContain('DTSTART;VALUE=DATE:20261122');
		expect(out).toContain('DTEND;VALUE=DATE:20261123');
		expect(out).toContain('TRANSP:TRANSPARENT');
	});

	it('writes a chore with a due time in UTC, for half an hour', () => {
		const out = lines(input({ chores: [chore({ dueTime: '19:00:00' })] }));
		expect(out).toContain('DTSTART:20261123T010000Z');
		expect(out).toContain('DTEND:20261123T013000Z');
	});

	it('puts the due label and the parent note in the description', () => {
		const out = lines(
			input({
				chores: [
					chore({
						dueLabel: 'after dinner',
						description: 'Use blue bags, please',
					}),
				],
			}),
		);
		expect(out).toContain(
			'DESCRIPTION:Assigned to: Mia\\nDue: after dinner\\nUse blue bags\\, please',
		);
	});

	it('gives each entry a stable UID', () => {
		const first = lines(input()).filter((l) => l.startsWith('UID:'));
		const second = lines(
			input({ now: new Date('2027-01-01T00:00:00Z') }),
		).filter((l) => l.startsWith('UID:'));
		expect(first).toEqual(second);
		expect(new Set(first).size).toBe(first.length);
		expect(first[0]).toBe('UID:chore-1-2026-11-15@chores.salabridge');
	});
});
