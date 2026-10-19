import { beforeEach, describe, expect, it, vi } from 'vitest';

// The queries themselves can't run here (they need Neon). The loader reads
// in parallel, so each select's result comes off a queue for the table it
// reads (`from()`), in the order that table is read. Every way of writing is a
// spy, so the tests can show that opening the screen only reads.
const mocks = vi.hoisted(() => {
	const queues = new Map<string, unknown[][]>();
	const select = vi.fn(() => {
		let table = '';
		const chain: Record<string, unknown> = {
			from: (t: unknown) => {
				table = tableName(t);
				return chain;
			},
			// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
			then: (resolve: (v: unknown) => void) =>
				resolve(queues.get(table)?.shift() ?? []),
		};
		for (const m of ['where', 'orderBy', 'limit', 'innerJoin']) {
			chain[m] = () => chain;
		}
		return chain;
	});
	const tableName = (t: unknown) =>
		(t as Record<symbol, string>)[Symbol.for('drizzle:Name')];
	const push = (table: string, rows: unknown[]) => {
		const queue = queues.get(table) ?? [];
		queue.push(rows);
		queues.set(table, queue);
	};
	return {
		queues,
		push,
		select,
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		execute: vi.fn(),
		batch: vi.fn(),
		transaction: vi.fn(),
	};
});
vi.mock('./drizzle.ts', () => ({ db: mocks }));
vi.mock('./household-today.ts', () => ({
	householdClock: async () => ({
		timeZone: 'America/Chicago',
		today: '2026-10-07',
	}),
	householdToday: async () => '2026-10-07',
}));

const { loadCompletionSummary } = await import('./completion-summary.ts');

const CHORE = '11111111-1111-4111-8111-111111111111';
const COMPLETION = '44444444-4444-4444-8444-444444444444';
const leo = { id: 'leo', householdId: 'h1', displayName: 'Leo' };

const chore = (over: Record<string, unknown> = {}) => ({
	id: CHORE,
	householdId: 'h1',
	title: 'Clean Bathroom Toilet',
	type: 'rotation',
	...over,
});

/** Queues what a load reads, per table. */
function queueLoad(
	opts: {
		completion?: Record<string, unknown> | null;
		chore?: Record<string, unknown>;
		balance?: number;
		goal?: number;
		week?: number;
		rotation?: { current: string; last: string | null } | null;
	} = {},
) {
	const completion =
		opts.completion === undefined
			? { memberId: 'leo', points: 20, reopenedAt: null }
			: opts.completion;
	mocks.push('chore_completions', completion ? [completion] : []);
	const c = opts.chore ?? chore();
	mocks.push('chores', [c]);
	mocks.push('points_ledger', [
		{ total: opts.balance ?? 160, week: opts.week ?? 160 },
	]);
	mocks.push('household_members', [{ goal: opts.goal ?? 200 }]);
	if (c.type !== 'rotation') return;
	const r = opts.rotation ?? { current: 'mia', last: 'leo' };
	mocks.push('chore_rotations', [
		{ currentMemberId: r.current, lastCompletedMemberId: r.last },
	]);
	mocks.push('chore_rotation_members', [
		{
			memberId: 'leo',
			name: 'Leo',
			position: 1,
			eligible: true,
			exclusionReason: null,
		},
		{
			memberId: 'mia',
			name: 'Mia',
			position: 2,
			eligible: true,
			exclusionReason: null,
		},
	]);
}

const expectNoWrites = () => {
	expect(mocks.insert).not.toHaveBeenCalled();
	expect(mocks.update).not.toHaveBeenCalled();
	expect(mocks.delete).not.toHaveBeenCalled();
	expect(mocks.execute).not.toHaveBeenCalled();
	expect(mocks.batch).not.toHaveBeenCalled();
	expect(mocks.transaction).not.toHaveBeenCalled();
};

beforeEach(() => {
	mocks.queues.clear();
	for (const m of Object.values(mocks)) {
		if (typeof m === 'function' && 'mockClear' in m) m.mockClear();
	}
});

describe('loadCompletionSummary', () => {
	it('reads the points from the completion row, and the total from the ledger', async () => {
		queueLoad({ balance: 160 });
		const summary = await loadCompletionSummary(leo, CHORE, COMPLETION);
		expect(summary).toMatchObject({
			title: 'Clean Bathroom Toilet',
			memberName: 'Leo',
			points: 20,
			totalPoints: 160,
		});
	});

	it('works out the weekly goal from the member goal and this week', async () => {
		queueLoad({ goal: 200, week: 160 });
		const summary = await loadCompletionSummary(leo, CHORE, COMPLETION);
		expect(summary?.goal).toEqual({
			earned: 160,
			goal: 200,
			remaining: 40,
			percent: 80,
			reached: false,
		});
	});

	it('names who has the turn now for a rotation chore', async () => {
		queueLoad();
		const summary = await loadCompletionSummary(leo, CHORE, COMPLETION);
		expect(summary?.rotation).toEqual({ nextName: 'Mia', nextIsYou: false });
	});

	it('drops the rotation for a personal chore', async () => {
		queueLoad({ chore: chore({ type: 'personal' }) });
		const summary = await loadCompletionSummary(leo, CHORE, COMPLETION);
		expect(summary?.rotation).toBeNull();
	});

	it('is a pure read: opening or refreshing it never writes or awards', async () => {
		queueLoad();
		const first = await loadCompletionSummary(leo, CHORE, COMPLETION);
		queueLoad();
		const refreshed = await loadCompletionSummary(leo, CHORE, COMPLETION);
		expect(refreshed).toEqual(first);
		expect(refreshed?.points).toBe(20);
		expectNoWrites();
	});

	it('is only for the member who earned it', async () => {
		queueLoad({
			completion: { memberId: 'mia', points: 20, reopenedAt: null },
		});
		expect(await loadCompletionSummary(leo, CHORE, COMPLETION)).toBeUndefined();
		expectNoWrites();
	});

	it('names whose chore it was when the member did it for someone else (SB-74)', async () => {
		queueLoad({
			completion: {
				memberId: 'mia',
				doneByMemberId: 'leo',
				points: 20,
				reopenedAt: null,
			},
		});
		// After the goal read: the assignee's name.
		mocks.push('household_members', [{ name: 'Mia' }]);
		const summary = await loadCompletionSummary(leo, CHORE, COMPLETION);
		expect(summary).toMatchObject({
			memberName: 'Leo',
			doneFor: { memberId: 'mia', name: 'Mia' },
			points: 20,
		});
		expectNoWrites();
	});

	it('is not for the assignee when someone else did it (the points are theirs)', async () => {
		queueLoad({
			completion: {
				memberId: 'leo',
				doneByMemberId: 'mia',
				points: 20,
				reopenedAt: null,
			},
		});
		expect(await loadCompletionSummary(leo, CHORE, COMPLETION)).toBeUndefined();
	});

	it("has no doneFor for the member's own chore", async () => {
		queueLoad();
		const summary = await loadCompletionSummary(leo, CHORE, COMPLETION);
		expect(summary?.doneFor).toBeNull();
	});

	it('is undefined for an unknown completion, or ids that are not UUIDs', async () => {
		queueLoad({ completion: null });
		expect(await loadCompletionSummary(leo, CHORE, COMPLETION)).toBeUndefined();
		mocks.select.mockClear();
		expect(
			await loadCompletionSummary(leo, 'nope', COMPLETION),
		).toBeUndefined();
		expect(await loadCompletionSummary(leo, CHORE, 'nope')).toBeUndefined();
		expect(mocks.select).not.toHaveBeenCalled();
	});

	it('says a favour still waiting for its OK is pending (SB-79)', async () => {
		queueLoad({
			completion: {
				memberId: 'mia',
				doneByMemberId: 'leo',
				points: 20,
				reopenedAt: null,
				approvalStatus: 'pending',
			},
		});
		mocks.push('household_members', [{ name: 'Mia' }]);
		const summary = await loadCompletionSummary(leo, CHORE, COMPLETION);
		expect(summary).toMatchObject({
			approvalStatus: 'pending',
			doneFor: { memberId: 'mia', name: 'Mia' },
			points: 20,
		});
	});

	it('is null once the favour was declined (SB-79)', async () => {
		queueLoad({
			completion: {
				memberId: 'mia',
				doneByMemberId: 'leo',
				points: 20,
				reopenedAt: null,
				approvalStatus: 'declined',
			},
		});
		expect(await loadCompletionSummary(leo, CHORE, COMPLETION)).toBeNull();
	});

	it('is null once a parent has reopened the completion', async () => {
		queueLoad({
			completion: {
				memberId: 'leo',
				points: 20,
				reopenedAt: new Date('2026-10-07T12:00:00Z'),
			},
		});
		expect(await loadCompletionSummary(leo, CHORE, COMPLETION)).toBeNull();
	});
});
