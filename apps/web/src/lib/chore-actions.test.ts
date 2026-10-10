import { describe, expect, it } from 'vitest';
import {
	type ChoreActionFacts,
	planRemind,
	planSkip,
} from './chore-actions.ts';

const facts = (over: Partial<ChoreActionFacts> = {}): ChoreActionFacts => ({
	type: 'rotation',
	dueToday: true,
	completed: false,
	holderId: 'm1',
	...over,
});

describe('planSkip', () => {
	it('lets a parent skip an open rotation turn', () => {
		expect(planSkip(facts())).toEqual({ ok: true, holderId: 'm1' });
	});

	it('skips a personal chore once and treats a repeat as a no-op', () => {
		expect(planSkip(facts({ type: 'personal' }))).toEqual({
			ok: true,
			holderId: 'm1',
		});
		expect(planSkip(facts({ type: 'personal', alreadySkipped: true }))).toEqual(
			{ ok: true, holderId: 'm1', noop: true },
		);
	});

	it('refuses to skip a rotation turn once its stages are under way', () => {
		expect(planSkip(facts({ started: true }))).toMatchObject({
			ok: false,
			status: 409,
			message: expect.stringMatching(/under way/),
		});
		// A personal chore has no turn to strand, so it can still be skipped.
		expect(planSkip(facts({ type: 'personal', started: true }))).toMatchObject({
			ok: true,
		});
	});

	it.each([
		['done', { completed: true }],
		['not due today', { dueToday: false }],
		['held by nobody', { holderId: null }],
	])('refuses a chore that is %s', (_name, over) => {
		expect(planSkip(facts(over))).toMatchObject({ ok: false, status: 409 });
	});

	it('words the no-holder refusal for the chore type', () => {
		expect(planSkip(facts({ holderId: null }))).toMatchObject({
			message: expect.stringMatching(/eligible/),
		});
		expect(planSkip(facts({ type: 'personal', holderId: null }))).toMatchObject(
			{ message: expect.stringMatching(/assigned/) },
		);
	});
});

describe('planRemind', () => {
	it('nudges the current holder', () => {
		expect(planRemind(facts())).toEqual({ ok: true, holderId: 'm1' });
	});

	it('does not nudge about a finished chore', () => {
		expect(planRemind(facts({ completed: true }))).toMatchObject({
			ok: false,
		});
	});
});
