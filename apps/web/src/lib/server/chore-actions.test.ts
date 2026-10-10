import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileState } from './profile-state.ts';

// The queries themselves can't run here (they need Neon), so this checks what
// skipChore and remindChore decide and what they send. Selects come off a
// queue (one result per query, in the order the code issues them); inserts and
// raw statements are recorded instead of executed.
type Insert = {
	kind: 'insert';
	table: unknown;
	values: unknown;
	ignoreConflicts: boolean;
	// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
	then: (resolve: (v: unknown) => void) => void;
};
type Execute = { kind: 'execute'; sql: string };

const mocks = vi.hoisted(() => {
	const queue: unknown[][] = [];
	const awaited: unknown[] = [];
	const select = vi.fn(() => {
		const chain: Record<string, unknown> = {
			// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
			then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
		};
		for (const m of ['from', 'where', 'orderBy', 'limit', 'innerJoin']) {
			chain[m] = () => chain;
		}
		return chain;
	});
	const insert = (table: unknown) => ({
		values: (values: unknown) => {
			const record = {
				kind: 'insert' as const,
				table,
				values,
				ignoreConflicts: false,
				// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
				then: (resolve: (v: unknown) => void) => {
					awaited.push(record);
					resolve(undefined);
				},
				onConflictDoNothing: () => {
					record.ignoreConflicts = true;
					return record;
				},
			};
			return record;
		},
	});
	const execute = vi.fn((query: { queryChunks?: unknown[] }) => ({
		kind: 'execute' as const,
		sql: JSON.stringify(query.queryChunks ?? query),
	}));
	const batch = vi.fn(async (_queries: unknown[]) => [
		[],
		{ rows: [{ member_id: 'next' }] },
		[],
		[],
	]);
	return { queue, awaited, select, insert, execute, batch };
});
vi.mock('./drizzle.ts', () => ({ db: mocks }));
vi.mock('./household-today.ts', () => ({
	householdToday: async () => '2026-10-06',
}));

const { ChoreActionError, remindChore, skipChore } = await import(
	'./chore-actions.ts'
);
const { choreReminders, choreSkips } = await import('@chore/db');

const CHORE_ID = '11111111-1111-4111-8111-111111111111';
const state = {
	actor: { householdId: 'h1', userId: 'u1' },
	member: { id: 'm-mom', householdId: 'h1' },
	mode: 'self',
} as unknown as ProfileState;

const chore = (over: Record<string, unknown> = {}) => ({
	id: CHORE_ID,
	householdId: 'h1',
	type: 'personal',
	frequency: 'daily',
	assignedMemberId: 'leo',
	...over,
});
const loopMembers = [
	{ memberId: 'leo', position: 1, eligible: true, exclusionReason: null },
	{ memberId: 'mia', position: 2, eligible: true, exclusionReason: null },
];

/** Queues what `load()` reads: chore, [rotation, members], instance, [completion, progress], skip. */
function queueLoad(
	c: Record<string, unknown>,
	opts: {
		members?: typeof loopMembers;
		instance?: Record<string, unknown>;
		completed?: boolean;
		started?: boolean;
		skipped?: boolean;
	} = {},
) {
	mocks.queue.push([c]);
	if (c.type === 'rotation') {
		mocks.queue.push([{ currentMemberId: 'leo', lastCompletedMemberId: null }]);
		mocks.queue.push(opts.members ?? loopMembers);
	}
	mocks.queue.push(opts.instance ? [opts.instance] : []);
	if (opts.instance) {
		mocks.queue.push(opts.completed ? [{ id: 'c1' }] : []);
		mocks.queue.push(opts.started ? [{ stageId: 's1' }] : []);
	}
	mocks.queue.push(opts.skipped ? [{ id: 'k1' }] : []);
}

const failure = async (run: () => Promise<unknown>) => {
	try {
		await run();
	} catch (e) {
		return e;
	}
	throw new Error('expected a rejection');
};

beforeEach(() => {
	mocks.queue.length = 0;
	mocks.awaited.length = 0;
	mocks.select.mockClear();
	mocks.batch.mockClear();
	mocks.batch.mockResolvedValue([
		[],
		{ rows: [{ member_id: 'next' }] },
		[],
		[],
	]);
});

describe('skipChore', () => {
	it('never queries for something that is not a UUID', async () => {
		const e = await failure(() => skipChore(state, 'nope'));
		expect(e).toBeInstanceOf(ChoreActionError);
		expect(e).toMatchObject({ status: 404 });
		expect(mocks.select).not.toHaveBeenCalled();
	});

	it("404s a chore that is not in the caller's household", async () => {
		mocks.queue.push([]);
		expect(await failure(() => skipChore(state, CHORE_ID))).toMatchObject({
			status: 404,
		});
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('logs one skip for a personal chore, ignoring a racing duplicate', async () => {
		queueLoad(chore());
		expect(await skipChore(state, CHORE_ID)).toEqual({ nextMemberId: null });
		expect(mocks.batch).not.toHaveBeenCalled();
		expect(mocks.awaited).toHaveLength(1);
		const [written] = mocks.awaited as Insert[];
		expect(written.table).toBe(choreSkips);
		expect(written.ignoreConflicts).toBe(true);
		expect(written.values).toMatchObject({
			householdId: 'h1',
			choreId: CHORE_ID,
			periodStart: '2026-10-06',
			memberId: 'leo',
			createdBy: 'u1',
		});
	});

	it('writes nothing the second time a personal chore is skipped', async () => {
		queueLoad(chore(), { skipped: true });
		await skipChore(state, CHORE_ID);
		expect(mocks.awaited).toHaveLength(0);
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('moves a rotation on in one batch: user, advance, skip row, instance', async () => {
		queueLoad(chore({ type: 'rotation', assignedMemberId: null }));
		expect(await skipChore(state, CHORE_ID)).toEqual({ nextMemberId: 'next' });
		expect(mocks.batch).toHaveBeenCalledTimes(1);
		const queries = mocks.batch.mock.calls[0][0] as (Insert | Execute)[];
		expect(queries.map((q) => q.kind)).toEqual([
			'execute',
			'execute',
			'insert',
			'execute',
		]);
		expect((queries[0] as Execute).sql).toContain('request.jwt.claims');
		expect((queries[1] as Execute).sql).toContain('advance_chore_rotation');
		const skip = queries[2] as Insert;
		expect(skip.table).toBe(choreSkips);
		expect(skip.ignoreConflicts).toBe(true);
		expect(skip.values).toMatchObject({ memberId: 'leo', createdBy: 'u1' });
		expect((queries[3] as Execute).sql).toContain('chore_instances');
		// Nothing was written outside the batch, so it all commits together.
		expect(mocks.awaited).toHaveLength(0);
	});

	it('refuses a rotation turn that is under way, a done chore, and a chore nobody holds', async () => {
		queueLoad(chore({ type: 'rotation' }), {
			instance: { id: 'i1', assignedMemberId: 'leo' },
			started: true,
		});
		expect(await failure(() => skipChore(state, CHORE_ID))).toMatchObject({
			status: 409,
			message: expect.stringMatching(/under way/),
		});
		queueLoad(chore(), {
			instance: { id: 'i1', assignedMemberId: 'leo' },
			completed: true,
		});
		expect(await failure(() => skipChore(state, CHORE_ID))).toMatchObject({
			status: 409,
		});
		queueLoad(chore({ assignedMemberId: null }));
		expect(await failure(() => skipChore(state, CHORE_ID))).toMatchObject({
			status: 409,
		});
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it.each([
		['RT001', 409],
		['RT002', 409],
		['42501', 403],
	])('maps database error %s to a %i', async (code, status) => {
		queueLoad(chore({ type: 'rotation' }));
		mocks.batch.mockRejectedValueOnce(
			new Error('failed', { cause: Object.assign(new Error('pg'), { code }) }),
		);
		expect(await failure(() => skipChore(state, CHORE_ID))).toMatchObject({
			status,
		});
	});

	it('does not hide errors it does not recognise', async () => {
		queueLoad(chore({ type: 'rotation' }));
		const boom = new Error('connection reset');
		mocks.batch.mockRejectedValueOnce(boom);
		expect(await failure(() => skipChore(state, CHORE_ID))).toBe(boom);
	});
});

describe('remindChore', () => {
	it('records a reminder for whoever holds the chore', async () => {
		queueLoad(chore());
		mocks.queue.push([{ name: 'Leo' }]); // the assignee
		mocks.queue.push([]); // no recent reminder
		expect(await remindChore(state, CHORE_ID)).toEqual({
			assigneeId: 'leo',
			assigneeName: 'Leo',
			sent: true,
		});
		const [written] = mocks.awaited as Insert[];
		expect(written.table).toBe(choreReminders);
		expect(written.values).toMatchObject({
			householdId: 'h1',
			choreId: CHORE_ID,
			assigneeMemberId: 'leo',
			createdBy: 'u1',
		});
	});

	it('does not send a second reminder inside the cooldown', async () => {
		queueLoad(chore());
		mocks.queue.push([{ name: 'Leo' }]);
		mocks.queue.push([{ id: 'r1' }]); // reminded a moment ago
		expect(await remindChore(state, CHORE_ID)).toMatchObject({ sent: false });
		expect(mocks.awaited).toHaveLength(0);
	});

	it('does not nudge about a chore that is already done', async () => {
		queueLoad(chore(), {
			instance: { id: 'i1', assignedMemberId: 'leo' },
			completed: true,
		});
		expect(await failure(() => remindChore(state, CHORE_ID))).toMatchObject({
			status: 409,
		});
	});
});
