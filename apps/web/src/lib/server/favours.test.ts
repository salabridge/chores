import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileState } from './profile-state.ts';

// The SQL functions are exercised against Postgres elsewhere (the DB README's
// SB-79 notes, rls-smoke.ts); this checks what the module sends, who it says
// is acting, and how it words the database's refusals.
const mocks = vi.hoisted(() => {
	const queue: unknown[][] = [];
	const select = vi.fn(() => {
		const chain: Record<string, unknown> = {
			// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
			then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
		};
		for (const m of ['from', 'where', 'orderBy', 'innerJoin', 'leftJoin']) {
			chain[m] = () => chain;
		}
		return chain;
	});
	const execute = vi.fn((query: { queryChunks?: unknown[] }) => ({
		sql: JSON.stringify(query.queryChunks ?? query),
	}));
	const batch = vi.fn(
		async (_queries: unknown[]): Promise<unknown[]> => [[], { rows: [] }],
	);
	return { queue, select, execute, batch };
});
vi.mock('./drizzle.ts', () => ({ db: mocks }));

const {
	askParentToApprove,
	decideFavour,
	FavourError,
	loadHouseholdFavours,
	loadMemberFavours,
	toFavourItem,
} = await import('./favours.ts');

const COMPLETION = '44444444-4444-4444-8444-444444444444';
const leoSelf = {
	mode: 'self',
	actor: { householdId: 'h1', userId: 'leo-user' },
	member: { id: 'leo', householdId: 'h1' },
} as unknown as ProfileState;
/** A parent's session on Mia's (managed kid) profile. */
const miaProfile = {
	mode: 'kid',
	actor: { householdId: 'h1', userId: 'mom-user' },
	member: { id: 'mia', householdId: 'h1' },
} as unknown as ProfileState;

type Row = Parameters<typeof toFavourItem>[0];
const row = (over: Partial<Row> = {}): Row => ({
	completionId: COMPLETION,
	choreId: 'chore-trash',
	title: 'Take out trash',
	points: 10,
	status: 'pending' as Row['status'],
	assigneeId: 'leo',
	assigneeName: 'Leo',
	doneById: 'mia',
	doneByName: 'Mia',
	completedAt: new Date('2026-10-18T08:00:00Z'),
	escalatedAt: null as Date | null,
	decidedById: null as string | null,
	decidedByName: null as string | null,
	decidedAt: null as Date | null,
	superseded: false,
	...over,
});

const failure = async (run: () => Promise<unknown>) => {
	try {
		await run();
	} catch (e) {
		return e;
	}
	throw new Error('expected a rejection');
};
const pg = (code: string) =>
	new Error('wrapped', { cause: Object.assign(new Error('pg'), { code }) });

beforeEach(() => {
	mocks.queue.length = 0;
	mocks.select.mockClear();
	mocks.execute.mockClear();
	mocks.batch.mockReset();
});

describe('toFavourItem', () => {
	it('lets the doer ask a parent about a pending favour they have not escalated', () => {
		const item = toFavourItem(row());
		expect(item).toMatchObject({
			status: 'pending',
			assignee: { memberId: 'leo', name: 'Leo' },
			doneBy: { memberId: 'mia', name: 'Mia' },
			completedAt: '2026-10-18T08:00:00.000Z',
			decidedBy: null,
			canAskParent: true,
		});
	});

	it('does not offer asking twice', () => {
		const item = toFavourItem(
			row({ escalatedAt: new Date('2026-10-18T09:00:00Z') }),
		);
		expect(item.canAskParent).toBe(false);
		expect(item.escalatedAt).toBe('2026-10-18T09:00:00.000Z');
	});

	it("offers asking a parent after the assignee's decline, not a parent's", () => {
		const declined = {
			status: 'declined' as const,
			decidedAt: new Date('2026-10-18T09:00:00Z'),
		};
		expect(
			toFavourItem(
				row({ ...declined, decidedById: 'leo', decidedByName: 'Leo' }),
			),
		).toMatchObject({ decidedByAssignee: true, canAskParent: true });
		expect(
			toFavourItem(
				row({ ...declined, decidedById: 'mom', decidedByName: 'Mom' }),
			),
		).toMatchObject({ decidedByAssignee: false, canAskParent: false });
	});

	it('does not offer it once the chore has been done again since the decline', () => {
		expect(
			toFavourItem(
				row({
					status: 'declined',
					decidedById: 'leo',
					decidedByName: 'Leo',
					superseded: true,
				}),
			).canAskParent,
		).toBe(false);
	});

	it('does not offer it for an approved favour', () => {
		expect(
			toFavourItem(row({ status: 'approved', decidedById: 'leo' }))
				.canAskParent,
		).toBe(false);
	});
});

describe('loaders', () => {
	it('loads the favours to approve and the ones the member did', async () => {
		mocks.queue.push([row()]);
		mocks.queue.push([row({ assigneeId: 'sam', assigneeName: 'Sam' })]);
		const favours = await loadMemberFavours({ id: 'leo', householdId: 'h1' });
		expect(favours.toApprove).toHaveLength(1);
		expect(favours.mine[0]?.assignee).toEqual({ memberId: 'sam', name: 'Sam' });
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('loads the household favours for parents', async () => {
		mocks.queue.push([row({ escalatedAt: new Date() }), row()]);
		expect(await loadHouseholdFavours('h1')).toHaveLength(2);
	});
});

describe('decideFavour', () => {
	it('decides in one batch as the signed-in user, acting as themselves', async () => {
		mocks.batch.mockResolvedValue([
			[],
			{ rows: [{ approval_status: 'approved', changed: true, points: 10 }] },
		]);
		expect(await decideFavour(leoSelf, COMPLETION, true)).toEqual({
			status: 'approved',
			changed: true,
			points: 10,
		});
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[0].sql).toContain('request.jwt.claims');
		expect(queries[0].sql).toContain('leo-user');
		expect(queries[1].sql).toContain('app.decide_favour');
		expect(queries[1].sql).toContain(COMPLETION);
		expect(queries[1].sql).not.toContain('"leo"');
	});

	it("passes the kid profile as acting_as, so a parent's session counts as the kid", async () => {
		mocks.batch.mockResolvedValue([
			[],
			{ rows: [{ approval_status: 'declined', changed: true, points: 0 }] },
		]);
		await decideFavour(miaProfile, COMPLETION, false);
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[0].sql).toContain('mom-user');
		expect(queries[1].sql).toContain('"mia"');
	});

	it('never queries for something that is not a UUID', async () => {
		expect(
			await failure(() => decideFavour(leoSelf, 'nope', true)),
		).toMatchObject({ status: 404 });
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it("words the database's refusals", async () => {
		const cases: [string, number, string][] = [
			['42501', 403, "You can't decide this favour."],
			['P0002', 404, 'That favour was not found.'],
			['CP005', 409, 'There is nothing to approve here.'],
			['CP006', 409, 'A parent has been asked to decide this one.'],
			[
				'CP007',
				409,
				'The chore has been done again since, so this favour is closed.',
			],
		];
		for (const [code, status, message] of cases) {
			mocks.batch.mockRejectedValueOnce(pg(code));
			const e = await failure(() => decideFavour(leoSelf, COMPLETION, true));
			expect(e).toBeInstanceOf(FavourError);
			expect(e).toMatchObject({ status, message });
		}
	});
});

describe('askParentToApprove', () => {
	it('escalates as the acting profile', async () => {
		mocks.batch.mockResolvedValue([
			[],
			{ rows: [{ approval_status: 'pending', changed: true }] },
		]);
		expect(await askParentToApprove(miaProfile, COMPLETION)).toEqual({
			status: 'pending',
			changed: true,
		});
		const queries = mocks.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[1].sql).toContain('app.escalate_favour');
		expect(queries[1].sql).toContain('"mia"');
	});

	it("says only the doer can ask, and that a parent's decision is final", async () => {
		mocks.batch.mockRejectedValueOnce(pg('42501'));
		expect(
			await failure(() => askParentToApprove(leoSelf, COMPLETION)),
		).toMatchObject({
			status: 403,
			message: 'Only whoever did the chore can ask a parent.',
		});
		mocks.batch.mockRejectedValueOnce(pg('CP008'));
		expect(
			await failure(() => askParentToApprove(leoSelf, COMPLETION)),
		).toMatchObject({
			status: 409,
			message: 'A parent already decided this one.',
		});
	});
});
