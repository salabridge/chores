import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileState } from './profile-state.ts';

// The queries themselves can't run here (they need Neon), so this checks what
// the module decides and what it sends. Selects come off a queue (one result
// per query, in the order the code issues them); inserts and raw statements
// are recorded instead of executed.
const mocks = vi.hoisted(() => {
	const queue: unknown[][] = [];
	const inserts: unknown[] = [];
	const select = vi.fn(() => {
		const chain: Record<string, unknown> = {
			// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
			then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
		};
		for (const m of [
			'from',
			'where',
			'orderBy',
			'limit',
			'innerJoin',
			'leftJoin',
		]) {
			chain[m] = () => chain;
		}
		return chain;
	});
	const insert = () => ({
		values: (values: unknown) => {
			const record = {
				values,
				// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
				then: (resolve: (v: unknown) => void) => {
					inserts.push(values);
					resolve(undefined);
				},
				onConflictDoNothing: () => record,
			};
			return record;
		},
	});
	const execute = vi.fn((query: { queryChunks?: unknown[] }) => ({
		sql: JSON.stringify(query.queryChunks ?? query),
	}));
	const batch = vi.fn(
		async (_queries: unknown[]): Promise<unknown[]> => [[], { rows: [] }],
	);
	return { queue, inserts, select, insert, execute, batch };
});
vi.mock('./drizzle.ts', () => ({ db: mocks }));
vi.mock('./household-today.ts', () => ({
	householdToday: async () => '2026-10-06',
}));

const { PersonalDetailError, completePersonalStep, loadPersonalDetail } =
	await import('./personal-detail.ts');

const CHORE = '11111111-1111-4111-8111-111111111111';
const S1 = '22222222-2222-4222-8222-222222222221';
const S2 = '22222222-2222-4222-8222-222222222222';
const S3 = '22222222-2222-4222-8222-222222222223';
const INSTANCE = '33333333-3333-4333-8333-333333333333';
const COMPLETION = '44444444-4444-4444-8444-444444444444';

/** A parent acting as Leo through his kid profile. */
const leoState = {
	mode: 'kid',
	actor: { householdId: 'h1', userId: 'parent-user' },
	member: { id: 'leo', householdId: 'h1' },
} as unknown as ProfileState;
/** Leo on his own login. */
const leoSelf = {
	mode: 'self',
	actor: { householdId: 'h1', userId: 'leo-user' },
	member: { id: 'leo', householdId: 'h1' },
} as unknown as ProfileState;
const miaState = {
	mode: 'self',
	actor: { householdId: 'h1', userId: 'mia-user' },
	member: { id: 'mia', householdId: 'h1' },
} as unknown as ProfileState;

const chore = (over: Record<string, unknown> = {}) => ({
	id: CHORE,
	householdId: 'h1',
	title: 'Clean Your Room',
	description: 'Use the blue bags',
	type: 'personal',
	points: 15,
	frequency: 'daily',
	assignedMemberId: 'leo',
	...over,
});
const stages = [
	{ id: S1, title: 'Put away toys', hint: null },
	{ id: S2, title: 'Dust', hint: null },
	{ id: S3, title: 'Vacuum', hint: null },
];
const instance = { id: INSTANCE, assignedMemberId: 'leo' };

/**
 * Queues what `loadState()` reads after the chore: the stages, then (when the
 * chore is due today) the instance with its open completion, and the stage
 * progress. `name` is the assignee lookup `loadPersonalDetail()` runs
 * alongside, which goes out after the stages and before the period's rows.
 */
function queueState(
	opts: {
		stageRows?: typeof stages;
		instance?: Record<string, unknown> | null;
		completion?: string;
		/** The open completion's approval status (SB-79); approved by default. */
		status?: 'approved' | 'pending';
		escalated?: boolean;
		doneStages?: string[];
		name?: string;
	} = {},
) {
	const inst = opts.instance === undefined ? instance : opts.instance;
	mocks.queue.push(opts.stageRows ?? stages);
	if (opts.name !== undefined) mocks.queue.push([{ name: opts.name }]);
	mocks.queue.push(
		inst
			? [
					{
						...inst,
						completionId: opts.completion ?? null,
						completionStatus: opts.completion
							? (opts.status ?? 'approved')
							: null,
						completionEscalatedAt: opts.escalated ? new Date() : null,
					},
				]
			: [],
	);
	mocks.queue.push((opts.doneStages ?? []).map((stageId) => ({ stageId })));
}

/** What `ensureInstance()` reads once the write is allowed. */
const queueEnsure = () => mocks.queue.push([instance]);

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
	mocks.inserts.length = 0;
	mocks.select.mockClear();
	mocks.execute.mockClear();
	mocks.batch.mockReset();
});

describe('completePersonalStep: who and what', () => {
	it('never queries for something that is not a UUID', async () => {
		expect(
			await failure(() => completePersonalStep(leoState, 'nope', null)),
		).toMatchObject({ status: 404 });
		expect(
			await failure(() => completePersonalStep(leoState, CHORE, 'nope')),
		).toMatchObject({ status: 404 });
		expect(mocks.select).not.toHaveBeenCalled();
	});

	it('404s a chore that is missing or is a rotation', async () => {
		mocks.queue.push([]);
		expect(
			await failure(() => completePersonalStep(leoState, CHORE, S2)),
		).toMatchObject({ status: 404 });
		mocks.queue.push([chore({ type: 'rotation' })]);
		expect(
			await failure(() => completePersonalStep(leoState, CHORE, S2)),
		).toMatchObject({ status: 404 });
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it("lets someone else do the assignee's chore for them, as themselves (SB-74)", async () => {
		mocks.queue.push([chore()]);
		queueState({ doneStages: [S1] });
		mocks.batch.mockResolvedValue([
			[],
			{ rows: [{ chore_completed: false, completion_id: null, points: 0 }] },
		]);
		await completePersonalStep(miaState, CHORE, S2);
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[0].sql).toContain('mia-user');
		expect(queries[1].sql).toContain('complete_chore_stage');
		// Mia is the doer: the database credits her, and the chore stays Leo's.
		expect(queries[1].sql).toContain('"mia"');
	});

	it('passes no doer when the assignee does their own chore', async () => {
		mocks.queue.push([chore({ points: 10 })]);
		queueState({ stageRows: [] });
		mocks.batch.mockResolvedValue([
			[],
			{ rows: [{ completion_id: COMPLETION, points: 10 }] },
		]);
		await completePersonalStep(leoSelf, CHORE, null);
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[1].sql).toContain('complete_chore_instance');
		expect(queries[1].sql).toContain('null');
		expect(queries[1].sql).not.toContain('"leo"');
	});

	it("passes the kid profile as acting_as, so a parent's session counts as the kid (SB-79)", async () => {
		mocks.queue.push([chore({ points: 10 })]);
		queueState({ stageRows: [] });
		mocks.batch.mockResolvedValue([
			[],
			{
				rows: [
					{
						completion_id: COMPLETION,
						points: 10,
						approval_status: 'approved',
					},
				],
			},
		]);
		await completePersonalStep(leoState, CHORE, null);
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[0].sql).toContain('parent-user');
		expect(queries[1].sql).toContain('"leo"');
	});

	it('reports a favour by a kid as pending, with no points yet (SB-79)', async () => {
		mocks.queue.push([chore({ points: 10 })]);
		queueState({ stageRows: [] });
		mocks.batch.mockResolvedValue([
			[],
			{
				rows: [
					{ completion_id: COMPLETION, points: 0, approval_status: 'pending' },
				],
			},
		]);
		expect(await completePersonalStep(miaState, CHORE, null)).toEqual({
			completionId: COMPLETION,
			points: 0,
			choreCompleted: true,
			approvalStatus: 'pending',
		});
	});

	it('sends the doer of a pending favour back to it, and stops the assignee (SB-79)', async () => {
		mocks.queue.push([chore()]);
		queueState({
			instance: { ...instance, completionDoneBy: 'mia' },
			completion: COMPLETION,
			status: 'pending',
			doneStages: [S1, S2, S3],
		});
		expect(await completePersonalStep(miaState, CHORE, S3)).toEqual({
			completionId: COMPLETION,
			points: 0,
			choreCompleted: true,
			approvalStatus: 'pending',
		});
		mocks.queue.push([chore()]);
		queueState({
			instance: { ...instance, completionDoneBy: 'mia' },
			completion: COMPLETION,
			status: 'pending',
			doneStages: [S1, S2, S3],
		});
		expect(
			await failure(() => completePersonalStep(leoSelf, CHORE, S3)),
		).toMatchObject({
			status: 409,
			message: 'Someone already did this chore. It is waiting for an OK.',
		});
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('lets a parent record another household member as the doer', async () => {
		const parent = {
			mode: 'self',
			actor: { householdId: 'h1', userId: 'mom-user', role: 'parent' },
			member: { id: 'mom', householdId: 'h1', role: 'parent' },
		} as unknown as ProfileState;
		const MIA = '55555555-5555-4555-8555-555555555555';
		mocks.queue.push([chore({ points: 10 })]);
		queueState({ stageRows: [] });
		mocks.queue.push([{ name: 'Mia' }]);
		mocks.batch.mockResolvedValue([
			[],
			{ rows: [{ completion_id: COMPLETION, points: 10 }] },
		]);
		await completePersonalStep(parent, CHORE, null, { doneBy: MIA });
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[0].sql).toContain('mom-user');
		expect(queries[1].sql).toContain(MIA);
	});

	it("404s a parent's doer who isn't in the household, and writes nothing", async () => {
		const parent = {
			mode: 'self',
			actor: { householdId: 'h1', userId: 'mom-user', role: 'parent' },
			member: { id: 'mom', householdId: 'h1', role: 'parent' },
		} as unknown as ProfileState;
		mocks.queue.push([chore()]);
		queueState();
		mocks.queue.push([]);
		expect(
			await failure(() =>
				completePersonalStep(parent, CHORE, S1, {
					doneBy: '66666666-6666-4666-8666-666666666666',
				}),
			),
		).toMatchObject({ status: 404 });
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('refuses a kid (or a kid profile) naming someone else as the doer', async () => {
		mocks.queue.push([chore()]);
		queueState();
		expect(
			await failure(() =>
				completePersonalStep(miaState, CHORE, S1, {
					doneBy: '66666666-6666-4666-8666-666666666666',
				}),
			),
		).toMatchObject({ status: 403 });
		mocks.queue.push([chore()]);
		queueState();
		expect(
			await failure(() =>
				completePersonalStep(leoState, CHORE, S1, { doneBy: 'mia' }),
			),
		).toMatchObject({ status: 403 });
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('409s a chore someone else already earned, instead of celebrating it', async () => {
		mocks.queue.push([chore()]);
		queueState({ completion: COMPLETION, doneStages: [S1, S2, S3] });
		const e = await failure(() => completePersonalStep(miaState, CHORE, S3));
		expect(e).toBeInstanceOf(PersonalDetailError);
		expect(e).toMatchObject({ status: 409 });
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('409s a chore with nobody assigned', async () => {
		mocks.queue.push([chore({ assignedMemberId: null })]);
		queueState({ instance: null });
		expect(
			await failure(() => completePersonalStep(leoState, CHORE, S1)),
		).toMatchObject({ status: 409 });
	});

	it("409s a chore that isn't due today", async () => {
		mocks.queue.push([chore({ frequency: 'weekends' })]);
		queueState({ instance: null });
		expect(
			await failure(() => completePersonalStep(leoState, CHORE, S1)),
		).toMatchObject({ status: 409 });
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('needs a real stage of this chore for a staged chore', async () => {
		mocks.queue.push([chore()]);
		queueState();
		expect(
			await failure(() => completePersonalStep(leoState, CHORE, null)),
		).toMatchObject({ status: 400 });
		mocks.queue.push([chore()]);
		queueState();
		expect(
			await failure(() =>
				completePersonalStep(
					leoState,
					CHORE,
					'99999999-9999-4999-8999-999999999999',
				),
			),
		).toMatchObject({ status: 404 });
		expect(mocks.batch).not.toHaveBeenCalled();
	});
});

describe('completePersonalStep: stages and points', () => {
	const stageRow = (over: Record<string, unknown>) => ({
		chore_completed: false,
		completion_id: null,
		points: 0,
		...over,
	});

	it('checks off a stage in one batch (user, then the SB-26 function) without points', async () => {
		mocks.queue.push([chore()]);
		queueState({ doneStages: [S1] });
		mocks.batch.mockResolvedValue([[], { rows: [stageRow({})] }]);

		const result = await completePersonalStep(leoState, CHORE, S2);
		expect(result).toEqual({
			completionId: null,
			points: 0,
			choreCompleted: false,
			approvalStatus: null,
		});
		expect(mocks.batch).toHaveBeenCalledTimes(1);
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries).toHaveLength(2);
		expect(queries[0].sql).toContain('request.jwt.claims');
		// The signed-in parent is who the database authorizes, not the kid.
		expect(queries[0].sql).toContain('parent-user');
		expect(queries[1].sql).toContain('complete_chore_stage');
		expect(queries[1].sql).toContain(S2);
		expect(queries[1].sql).toContain(INSTANCE);
	});

	it('awards the points on the last stage and returns the completion', async () => {
		mocks.queue.push([chore()]);
		queueState({ doneStages: [S1, S2] });
		mocks.batch.mockResolvedValue([
			[],
			{
				rows: [
					stageRow({
						chore_completed: true,
						completion_id: COMPLETION,
						points: 15,
						approval_status: 'approved',
					}),
				],
			},
		]);

		expect(await completePersonalStep(leoState, CHORE, S3)).toEqual({
			completionId: COMPLETION,
			points: 15,
			choreCompleted: true,
			approvalStatus: 'approved',
		});
		// One call, one transaction: the stage, the completion and the ledger row
		// are all written by the database function, never by this module.
		expect(mocks.batch).toHaveBeenCalledTimes(1);
		// The period's instance already exists, so this module inserts nothing.
		expect(mocks.inserts).toHaveLength(0);
	});

	it('completes a chore without stages with complete_chore_instance', async () => {
		mocks.queue.push([chore({ points: 10 })]);
		queueState({ stageRows: [] });
		mocks.batch.mockResolvedValue([
			[],
			{
				rows: [
					{
						completion_id: COMPLETION,
						points: 10,
						approval_status: 'approved',
					},
				],
			},
		]);

		expect(await completePersonalStep(leoState, CHORE, null)).toEqual({
			completionId: COMPLETION,
			points: 10,
			choreCompleted: true,
			approvalStatus: 'approved',
		});
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[1].sql).toContain('complete_chore_instance');
	});

	it('opens the period lazily: the instance row is created for the assignee', async () => {
		mocks.queue.push([chore()]);
		queueState({ instance: null });
		queueEnsure();
		mocks.batch.mockResolvedValue([[], { rows: [stageRow({})] }]);
		await completePersonalStep(leoState, CHORE, S1);
		expect(mocks.inserts).toEqual([
			{
				householdId: 'h1',
				choreId: CHORE,
				periodStart: '2026-10-06',
				assignedMemberId: 'leo',
			},
		]);
	});

	it('does not award twice: a finished chore returns its completion and writes nothing', async () => {
		mocks.queue.push([chore()]);
		queueState({ completion: COMPLETION, doneStages: [S1, S2, S3] });

		const again = await completePersonalStep(leoState, CHORE, S3);
		expect(again).toEqual({
			completionId: COMPLETION,
			points: 0,
			choreCompleted: true,
			approvalStatus: 'approved',
		});
		expect(mocks.batch).not.toHaveBeenCalled();
		expect(mocks.inserts).toHaveLength(0);
	});

	it('maps a locked stage to a message for the screen', async () => {
		mocks.queue.push([chore()]);
		queueState({ doneStages: [S1] });
		mocks.batch.mockRejectedValue(
			Object.assign(new Error('locked'), { code: 'CP001' }),
		);
		const e = await failure(() => completePersonalStep(leoState, CHORE, S3));
		expect(e).toMatchObject({
			status: 409,
			message: 'Finish the earlier stages first.',
		});
	});

	it('maps a database refusal (drizzle wraps it) to a 403', async () => {
		mocks.queue.push([chore()]);
		queueState({ doneStages: [S1] });
		const cause = Object.assign(new Error('pg'), { code: '42501' });
		mocks.batch.mockRejectedValue(new Error('wrapped', { cause }));
		expect(
			await failure(() => completePersonalStep(leoState, CHORE, S2)),
		).toMatchObject({ status: 403 });
	});
});

describe('loadPersonalDetail', () => {
	const leo = { id: 'leo', householdId: 'h1' };

	it('lets the assignee complete, with the stages in order', async () => {
		mocks.queue.push([chore()]);
		queueState({ doneStages: [S1], name: 'Leo' });
		const detail = await loadPersonalDetail(leo, CHORE);
		expect(detail).toMatchObject({
			title: 'Clean Your Room',
			points: 15,
			assigneeName: 'Leo',
			isAssignee: true,
			canComplete: true,
			completedThisPeriod: false,
		});
		expect(detail?.stages.map((s) => s.state)).toEqual([
			'completed',
			'current',
			'locked',
		]);
	});

	it('offers anyone else the chore to do for the assignee (SB-74)', async () => {
		mocks.queue.push([chore()]);
		queueState({ name: 'Leo' });
		const detail = await loadPersonalDetail(
			{ id: 'mia', householdId: 'h1' },
			CHORE,
		);
		expect(detail).toMatchObject({
			isAssignee: false,
			canComplete: false,
			canCompleteForAssignee: true,
			assigneeId: 'leo',
			assigneeName: 'Leo',
			doneBy: null,
		});
	});

	it('names who did it when someone did it for the assignee', async () => {
		mocks.queue.push([chore()]);
		queueState({
			instance: { ...instance, completionDoneBy: 'mia' },
			completion: COMPLETION,
			doneStages: [S1, S2, S3],
			name: 'Leo',
		});
		mocks.queue.push([{ name: 'Mia' }]);
		const detail = await loadPersonalDetail(leo, CHORE);
		expect(detail).toMatchObject({
			completedThisPeriod: true,
			doneBy: { memberId: 'mia', name: 'Mia' },
			canComplete: false,
			canCompleteForAssignee: false,
		});
	});

	it('shows a pending favour as not done yet, not open, and not "Done by" (SB-79)', async () => {
		mocks.queue.push([chore()]);
		queueState({
			instance: { ...instance, completionDoneBy: 'mia' },
			completion: COMPLETION,
			status: 'pending',
			escalated: true,
			doneStages: [S1, S2, S3],
			name: 'Leo',
		});
		mocks.queue.push([{ name: 'Mia' }]);
		const detail = await loadPersonalDetail(leo, CHORE);
		expect(detail).toMatchObject({
			completedThisPeriod: false,
			doneBy: null,
			pendingFavour: {
				completionId: COMPLETION,
				doneBy: { memberId: 'mia', name: 'Mia' },
				escalated: true,
			},
			canComplete: false,
			canCompleteForAssignee: false,
		});
		expect(detail?.stages.every((s) => s.state === 'completed')).toBe(true);
	});

	it('shows a finished chore as all done with no button', async () => {
		mocks.queue.push([chore()]);
		queueState({
			completion: COMPLETION,
			doneStages: [S1, S2, S3],
			name: 'Leo',
		});
		const detail = await loadPersonalDetail(leo, CHORE);
		expect(detail?.completedThisPeriod).toBe(true);
		expect(detail?.canComplete).toBe(false);
		expect(detail?.stages.every((s) => s.state === 'completed')).toBe(true);
	});

	it("names the period's assignee when it was handed to someone else", async () => {
		mocks.queue.push([chore()]);
		queueState({
			instance: { id: INSTANCE, assignedMemberId: 'mia' },
			doneStages: [S1],
			name: 'Leo',
		});
		mocks.queue.push([{ name: 'Mia' }]);
		const detail = await loadPersonalDetail(leo, CHORE);
		expect(detail).toMatchObject({ assigneeName: 'Mia', isAssignee: false });
	});

	it('only reads: nothing is written by looking at the screen', async () => {
		mocks.queue.push([chore()]);
		queueState({ name: 'Leo' });
		await loadPersonalDetail(leo, CHORE);
		expect(mocks.inserts).toHaveLength(0);
		expect(mocks.batch).not.toHaveBeenCalled();
		expect(mocks.execute).not.toHaveBeenCalled();
	});

	it('is undefined for a chore outside the household, and null for a rotation', async () => {
		mocks.queue.push([]);
		expect(await loadPersonalDetail(leo, CHORE)).toBeUndefined();
		mocks.queue.push([chore({ type: 'rotation' })]);
		expect(await loadPersonalDetail(leo, CHORE)).toBeNull();
	});
});
