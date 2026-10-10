import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidTimeZone } from './recurrence.ts';
import {
	type DueChore,
	duePeriods,
	familyStreak,
	memberDayStatus,
	personalStreak,
	resolveDueChores,
} from './streaks.ts';

// 2026-10-07 is a Wednesday; 2026-10-03/04 are Saturday/Sunday.

const done = (memberId: string, date: string): DueChore => ({
	memberId,
	date,
	outcome: 'done',
});
const missed = (memberId: string, date: string): DueChore => ({
	memberId,
	date,
	outcome: 'missed',
});
const skipped = (memberId: string, date: string): DueChore => ({
	memberId,
	date,
	outcome: 'skipped',
});

test('a day qualifies only when every due chore is done', () => {
	assert.equal(memberDayStatus([done('a', 'x'), done('a', 'x')]), 'qualified');
	assert.equal(memberDayStatus([done('a', 'x'), missed('a', 'x')]), 'missed');
	assert.equal(memberDayStatus([]), 'none');
});

test('skipped chores do not count against the member', () => {
	assert.equal(
		memberDayStatus([done('a', 'x'), skipped('a', 'x')]),
		'qualified',
	);
	assert.equal(memberDayStatus([skipped('a', 'x')]), 'none');
});

test('personal streak continues across consecutive qualifying days', () => {
	const chores = [
		done('a', '2026-10-05'),
		done('a', '2026-10-06'),
		done('a', '2026-10-07'),
	];
	assert.deepEqual(personalStreak(chores, 'a', '2026-10-07'), {
		days: 3,
		exceptions: 0,
	});
});

test("today's unfinished chores do not break the streak yet", () => {
	const chores = [
		done('a', '2026-10-05'),
		done('a', '2026-10-06'),
		missed('a', '2026-10-07'),
	];
	assert.equal(personalStreak(chores, 'a', '2026-10-07').days, 2);
});

test('a missed earlier day breaks the streak', () => {
	const chores = [
		done('a', '2026-10-04'),
		done('a', '2026-10-05'),
		missed('a', '2026-10-06'),
		done('a', '2026-10-07'),
	];
	assert.equal(personalStreak(chores, 'a', '2026-10-07').days, 1);
});

test('days with nothing due neither extend nor break a streak', () => {
	const chores = [done('a', '2026-10-05'), done('a', '2026-10-07')];
	assert.equal(personalStreak(chores, 'a', '2026-10-07').days, 2);
});

test('only the member own chores count', () => {
	const chores = [done('a', '2026-10-07'), missed('b', '2026-10-06')];
	assert.equal(personalStreak(chores, 'a', '2026-10-07').days, 1);
});

test('an exception covers a miss without extending the streak', () => {
	const chores = [
		done('a', '2026-10-05'),
		missed('a', '2026-10-06'),
		done('a', '2026-10-07'),
	];
	const s = personalStreak(chores, 'a', '2026-10-07', [
		{ memberId: 'a', date: '2026-10-06' },
	]);
	assert.deepEqual(s, { days: 2, exceptions: 1 });
});

test('family streak needs every member to qualify', () => {
	const both = [
		done('a', '2026-10-06'),
		done('b', '2026-10-06'),
		done('a', '2026-10-07'),
		done('b', '2026-10-07'),
	];
	assert.equal(familyStreak(both, ['a', 'b'], '2026-10-07').days, 2);
	const oneMissed = [
		done('a', '2026-10-06'),
		missed('b', '2026-10-06'),
		done('a', '2026-10-07'),
		done('b', '2026-10-07'),
	];
	assert.equal(familyStreak(oneMissed, ['a', 'b'], '2026-10-07').days, 1);
});

test('family streak excludes members with an exception and counts it', () => {
	const chores = [
		done('a', '2026-10-05'),
		done('b', '2026-10-05'),
		done('a', '2026-10-06'),
		missed('b', '2026-10-06'),
		done('a', '2026-10-07'),
		done('b', '2026-10-07'),
	];
	const s = familyStreak(chores, ['a', 'b'], '2026-10-07', [
		{ memberId: 'b', date: '2026-10-06' },
	]);
	assert.deepEqual(s, { days: 3, exceptions: 1 });
});

test('a member with nothing due does not hold the family back', () => {
	const chores = [done('a', '2026-10-07')];
	assert.equal(familyStreak(chores, ['a', 'b'], '2026-10-07').days, 1);
});

test('weekly chores are due on the Sunday of their week', () => {
	assert.deepEqual(
		duePeriods('weekly', '2026-09-01', '2026-10-01', '2026-10-11'),
		[
			['2026-09-28', '2026-10-04'],
			['2026-10-05', '2026-10-11'],
		],
	);
	assert.deepEqual(
		duePeriods('weekends', '2026-09-01', '2026-10-01', '2026-10-05'),
		[
			['2026-10-03', '2026-10-03'],
			['2026-10-04', '2026-10-04'],
		],
	);
});

test('periods that ended before the chore existed do not count', () => {
	const dates = duePeriods(
		'daily',
		'2026-10-06',
		'2026-10-04',
		'2026-10-07',
	).map(([, due]) => due);
	assert.deepEqual(dates, ['2026-10-06', '2026-10-07']);
});

const chore = {
	id: 'c1',
	frequency: 'daily' as const,
	assignedMemberId: 'a',
	createdAt: new Date('2026-09-01T00:00:00Z'),
};
const inst = (date: string) => ({
	id: `i-${date}`,
	choreId: 'c1',
	periodStart: date,
	assignedMemberId: 'a',
});

test('a day with no instance row counts as missed', () => {
	const due = resolveDueChores({
		chores: [chore],
		instances: [inst('2026-10-06')],
		completions: [
			{
				instanceId: 'i-2026-10-06',
				completedAt: new Date('2026-10-06T15:00:00Z'),
			},
		],
		timeZone: 'UTC',
		from: '2026-10-05',
		today: '2026-10-07',
	});
	assert.deepEqual(
		due.map((d) => [d.date, d.outcome]),
		[
			['2026-10-05', 'missed'],
			['2026-10-06', 'done'],
			['2026-10-07', 'missed'],
		],
	);
});

test('a late completion stays missed and a skipped instance is skipped', () => {
	const due = resolveDueChores({
		chores: [chore],
		instances: [inst('2026-10-05'), inst('2026-10-06')],
		completions: [
			// Done on the 6th for the 5th's chore: late, so still missed.
			{
				instanceId: 'i-2026-10-05',
				completedAt: new Date('2026-10-06T15:00:00Z'),
			},
		],
		timeZone: 'UTC',
		from: '2026-10-05',
		today: '2026-10-06',
		skippedInstanceIds: new Set(['i-2026-10-06']),
	});
	assert.deepEqual(
		due.map((d) => d.outcome),
		['missed', 'skipped'],
	);
});

test('a rotation chore with no instance has no known member and is left out', () => {
	const due = resolveDueChores({
		chores: [{ ...chore, assignedMemberId: null }],
		instances: [],
		completions: [],
		timeZone: 'UTC',
		from: '2026-10-05',
		today: '2026-10-06',
	});
	assert.deepEqual(due, []);
});

test('the day boundary follows the household time zone, not UTC', () => {
	const outcomeIn = (timeZone: string, completedAt: Date) =>
		resolveDueChores({
			chores: [chore],
			instances: [inst('2026-10-06')],
			completions: [{ instanceId: 'i-2026-10-06', completedAt }],
			timeZone,
			from: '2026-10-06',
			today: '2026-10-06',
		})[0]?.outcome;
	// 03:30 UTC on the 7th is 22:30 on the 6th in Chicago (CDT, UTC-5): on
	// time there, already the next day in UTC.
	const lateNightChicago = new Date('2026-10-07T03:30:00Z');
	assert.equal(outcomeIn('America/Chicago', lateNightChicago), 'done');
	assert.equal(outcomeIn('UTC', lateNightChicago), 'missed');
	// 22:30 UTC on the 6th is already the 7th in Tokyo (UTC+9).
	const lateNightUtc = new Date('2026-10-06T22:30:00Z');
	assert.equal(outcomeIn('UTC', lateNightUtc), 'done');
	assert.equal(outcomeIn('Asia/Tokyo', lateNightUtc), 'missed');
});

test('late-night completions keep a streak alive in a non-UTC zone', () => {
	// Each chore is done at 22:30 Chicago time, which is the next UTC day.
	const dates = ['2026-10-05', '2026-10-06', '2026-10-07'];
	const due = resolveDueChores({
		chores: [chore],
		instances: dates.map(inst),
		completions: dates.map((d) => ({
			instanceId: `i-${d}`,
			completedAt: new Date(`${d}T22:30:00-05:00`),
		})),
		timeZone: 'America/Chicago',
		from: '2026-10-05',
		today: '2026-10-07',
	});
	assert.equal(personalStreak(due, 'a', '2026-10-07').days, 3);
});

test('time zone names are validated', () => {
	assert.equal(isValidTimeZone('America/Chicago'), true);
	assert.equal(isValidTimeZone('Not/AZone'), false);
});
