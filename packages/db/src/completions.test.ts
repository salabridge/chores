import assert from 'node:assert/strict';
import { test } from 'node:test';
import { weeklyGoalProgress } from './completions.ts';

test('progress toward the goal', () => {
	assert.deepEqual(weeklyGoalProgress(160, 200), {
		earned: 160,
		goal: 200,
		remaining: 40,
		percent: 80,
		reached: false,
	});
});

test('reaching or passing the goal caps the bar at 100%', () => {
	assert.deepEqual(weeklyGoalProgress(250, 200), {
		earned: 250,
		goal: 200,
		remaining: 0,
		percent: 100,
		reached: true,
	});
});

test('percent rounds down so 100% only shows once the goal is reached', () => {
	assert.equal(weeklyGoalProgress(199, 200).percent, 99);
});

test('a net-negative week (reversals) counts as 0 earned', () => {
	const p = weeklyGoalProgress(-10, 200);
	assert.equal(p.earned, 0);
	assert.equal(p.remaining, 200);
	assert.equal(p.percent, 0);
});

test('a goal of 0 is always reached', () => {
	const p = weeklyGoalProgress(0, 0);
	assert.equal(p.reached, true);
	assert.equal(p.percent, 100);
});
