import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	addDays,
	choreDueDate,
	chorePeriodStart,
	dueDayState,
	isIsoWeekday,
	isoWeekday,
	localDate,
	previousPeriodStart,
} from './recurrence.ts';

// 2026-10-01 is a Thursday; 2026-10-03/04 are Saturday/Sunday.

test('daily periods are the day itself', () => {
	assert.equal(chorePeriodStart('daily', '2026-10-01'), '2026-10-01');
	assert.equal(previousPeriodStart('daily', '2026-10-01'), '2026-09-30');
});

test('weekly periods start on the ISO Monday', () => {
	assert.equal(chorePeriodStart('weekly', '2026-10-01'), '2026-09-28');
	assert.equal(chorePeriodStart('weekly', '2026-09-28'), '2026-09-28');
	assert.equal(chorePeriodStart('weekly', '2026-10-04'), '2026-09-28');
	assert.equal(chorePeriodStart('weekly', '2026-10-05'), '2026-10-05');
	// Across a year boundary.
	assert.equal(chorePeriodStart('weekly', '2027-01-01'), '2026-12-28');
	assert.equal(previousPeriodStart('weekly', '2026-09-28'), '2026-09-21');
});

test('weekends chores only have periods on Saturday and Sunday', () => {
	assert.equal(chorePeriodStart('weekends', '2026-10-01'), null);
	assert.equal(chorePeriodStart('weekends', '2026-10-03'), '2026-10-03');
	assert.equal(chorePeriodStart('weekends', '2026-10-04'), '2026-10-04');
	assert.equal(previousPeriodStart('weekends', '2026-10-04'), '2026-10-03');
	assert.equal(previousPeriodStart('weekends', '2026-10-03'), '2026-09-27');
	assert.throws(() => previousPeriodStart('weekends', '2026-10-01'));
});

test('dates are validated', () => {
	assert.throws(() => chorePeriodStart('daily', '2026-02-30'), RangeError);
	assert.throws(() => chorePeriodStart('daily', '10/01/2026'), RangeError);
	assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

test('localDate uses the given time zone, not the server one', () => {
	const at = new Date('2026-10-02T05:30:00Z');
	assert.equal(localDate('America/Los_Angeles', at), '2026-10-01');
	assert.equal(localDate('Asia/Tokyo', at), '2026-10-02');
});

test('isoWeekday numbers Monday 1 to Sunday 7', () => {
	assert.equal(isoWeekday('2026-09-28'), 1);
	assert.equal(isoWeekday('2026-10-01'), 4);
	assert.equal(isoWeekday('2026-10-04'), 7);
	assert.equal(isIsoWeekday(1), true);
	assert.equal(isIsoWeekday(7), true);
	assert.equal(isIsoWeekday(0), false);
	assert.equal(isIsoWeekday(8), false);
	assert.equal(isIsoWeekday(2.5), false);
	assert.equal(isIsoWeekday('3'), false);
});

test('choreDueDate is the weekday within a weekly period', () => {
	// The week of Monday 2026-09-28.
	assert.equal(choreDueDate('weekly', '2026-09-28', 1), '2026-09-28');
	assert.equal(choreDueDate('weekly', '2026-09-28', 4), '2026-10-01');
	assert.equal(choreDueDate('weekly', '2026-09-28', 7), '2026-10-04');
	// Across a year boundary.
	assert.equal(choreDueDate('weekly', '2026-12-28', 5), '2027-01-01');
	// It stays inside the period chorePeriodStart gives for that date.
	const due = choreDueDate('weekly', '2026-09-28', 6);
	assert.equal(due && chorePeriodStart('weekly', due), '2026-09-28');
});

test('choreDueDate is null without a day or for other frequencies', () => {
	assert.equal(choreDueDate('weekly', '2026-09-28', null), null);
	assert.equal(choreDueDate('weekly', '2026-09-28', undefined), null);
	assert.equal(choreDueDate('daily', '2026-10-01', 4), null);
	assert.equal(choreDueDate('weekends', '2026-10-03', 6), null);
	assert.throws(() => choreDueDate('weekly', '2026-09-28', 0), RangeError);
	assert.throws(() => choreDueDate('weekly', '2026-09-28', 8), RangeError);
});

test('dueDayState compares today with the due date', () => {
	assert.equal(dueDayState('2026-09-29', '2026-10-01'), 'upcoming');
	assert.equal(dueDayState('2026-10-01', '2026-10-01'), 'today');
	assert.equal(dueDayState('2026-10-02', '2026-10-01'), 'overdue');
	assert.throws(() => dueDayState('2026-10-1', '2026-10-01'), RangeError);
});
