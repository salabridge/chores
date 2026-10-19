import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileState } from './profile-state.ts';

// The queries can't run here (they need Neon), so this checks what the module
// decides and what it sends, as personal-detail.test.ts does. Selects come off
// a queue in the order the code issues them; inserts are recorded.
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

const { RotationDetailError, completeRotationTurn, loadRotationDetail } =
	await import('./rotation-detail.ts');

const CHORE = '11111111-1111-4111-8111-111111111111';
const INSTANCE = '33333333-3333-4333-8333-333333333333';
const COMPLETION = '44444444-4444-4444-8444-444444444444';

const state = (
	id: string,
	over: { mode?: 'self' | 'kid'; role?: string } = {},
) =>
	({
		mode: over.mode ?? 'self',
		actor: { householdId: 'h1', userId: `${id}-user`, role: over.role },
		member: { id, householdId: 'h1', role: over.role ?? 'kid' },
	}) as unknown as ProfileState;

const chore = {
	id: CHORE,
	householdId: 'h1',
	title: 'Clean the toilet',
	description: null,
	type: 'rotation',
	points: 20,
	frequency: 'daily',
	dueWeekday: null,
	assignedMemberId: null,
};
const member = (memberId: string, name: string, position: number) => ({
	memberId,
	name,
	position,
	eligible: true,
	exclusionReason: null,
});

/** The chore, its rotation (Leo's turn) and the loop. */
function queueRotation() {
	mocks.queue.push([chore]);
	mocks.queue.push([
		{ choreId: CHORE, currentMemberId: 'leo', lastCompletedMemberId: 'mia' },
	]);
	mocks.queue.push([member('leo', 'Leo', 1), member('mia', 'Mia', 2)]);
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
	mocks.inserts.length = 0;
	mocks.select.mockClear();
	mocks.execute.mockClear();
	mocks.batch.mockReset();
});

describe('completeRotationTurn (SB-74)', () => {
	const done = [
		[],
		{
			rows: [
				{ completion_id: COMPLETION, points: 20, already_completed: false },
			],
		},
	];

	it('passes no doer when the turn-holder completes their turn', async () => {
		queueRotation();
		mocks.queue.push([{ id: INSTANCE, assignedMemberId: 'leo' }]);
		mocks.batch.mockResolvedValue(done);
		await completeRotationTurn(state('leo'), CHORE);
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[1].sql).toContain('complete_chore_instance');
		expect(queries[1].sql).not.toContain('"leo"');
	});

	it("lets someone else do the turn-holder's turn for them, as the doer", async () => {
		queueRotation();
		mocks.queue.push([{ id: INSTANCE, assignedMemberId: 'leo' }]);
		mocks.batch.mockResolvedValue(done);
		expect(await completeRotationTurn(state('mia'), CHORE)).toEqual({
			completionId: COMPLETION,
			points: 20,
			choreCompleted: true,
		});
		// The period's instance is still Leo's turn; Mia is passed as done_by.
		expect(mocks.inserts).toEqual([
			{
				householdId: 'h1',
				choreId: CHORE,
				periodStart: '2026-10-06',
				assignedMemberId: 'leo',
			},
		]);
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[0].sql).toContain('mia-user');
		expect(queries[1].sql).toContain('"mia"');
	});

	it('refuses a kid naming someone else as the doer', async () => {
		queueRotation();
		const e = await failure(() =>
			completeRotationTurn(state('mia'), CHORE, {
				doneBy: '55555555-5555-4555-8555-555555555555',
			}),
		);
		expect(e).toBeInstanceOf(RotationDetailError);
		expect(e).toMatchObject({ status: 403 });
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('maps a doer from another household to a 404', async () => {
		queueRotation();
		mocks.queue.push([{ id: INSTANCE, assignedMemberId: 'leo' }]);
		const cause = Object.assign(new Error('pg'), { code: 'CP004' });
		mocks.batch.mockRejectedValue(new Error('wrapped', { cause }));
		expect(
			await failure(() => completeRotationTurn(state('mia'), CHORE)),
		).toMatchObject({ status: 404 });
	});
});

describe('loadRotationDetail (SB-74)', () => {
	it("offers someone else the turn-holder's turn while it's open", async () => {
		queueRotation();
		mocks.queue.push([]); // no instance yet
		mocks.queue.push([]); // no stages
		const detail = await loadRotationDetail(
			{ id: 'mia', householdId: 'h1' },
			CHORE,
		);
		expect(detail).toMatchObject({
			isMyTurn: false,
			canComplete: false,
			canCompleteForTurnHolder: true,
			doneBy: null,
		});
	});

	it('names who did a turn for the turn-holder', async () => {
		queueRotation();
		mocks.queue.push([{ id: INSTANCE, assignedMemberId: 'leo' }]);
		mocks.queue.push([]); // no stages
		mocks.queue.push([{ id: COMPLETION, doneByMemberId: 'mia' }]);
		mocks.queue.push([{ name: 'Mia' }]);
		mocks.queue.push([]); // stage progress
		const detail = await loadRotationDetail(
			{ id: 'leo', householdId: 'h1' },
			CHORE,
		);
		expect(detail).toMatchObject({
			completedThisPeriod: true,
			doneBy: { memberId: 'mia', name: 'Mia' },
			canComplete: false,
			canCompleteForTurnHolder: false,
		});
	});
});
