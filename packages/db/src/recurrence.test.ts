import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	addDays,
	chorePeriodStart,
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
