import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCalendarToken, isCalendarToken } from './calendar-token.ts';

test('createCalendarToken returns a url-safe 43 character token', () => {
	const a = createCalendarToken();
	const b = createCalendarToken();
	assert.match(a, /^[A-Za-z0-9_-]{43}$/);
	assert.notEqual(a, b);
	assert.ok(isCalendarToken(a));
});

test('isCalendarToken rejects anything that is not the right shape', () => {
	assert.equal(isCalendarToken(''), false);
	assert.equal(isCalendarToken('short'), false);
	assert.equal(isCalendarToken(`${'a'.repeat(42)}/`), false);
	assert.equal(isCalendarToken(`${'a'.repeat(43)}x`), false);
	assert.equal(isCalendarToken('a'.repeat(43)), true);
});
