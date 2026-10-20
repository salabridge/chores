import { beforeEach, describe, expect, it, vi } from 'vitest';

// The statements can't run here (they need Neon), so this checks what
// giftPoints decides before it writes, and the row it writes.
const mocks = vi.hoisted(() => {
	const queue: unknown[][] = [];
	const select = {
		// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
		then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
		from: () => select,
		leftJoin: () => select,
		where: () => select,
		orderBy: () => select,
		limit: () => select,
	};
	const values = vi.fn(async (_row: unknown) => undefined);
	const db = {
		queue,
		select: () => select,
		insert: vi.fn((_table: unknown) => ({ values })),
		values,
		execute: vi.fn((query: unknown) => query),
		batch: vi.fn(async (_queries: unknown[]) => [] as unknown[]),
	};
	return { db };
});
vi.mock('./drizzle.ts', () => ({ db: mocks.db }));

const {
	GiftError,
	giftPoints,
	listRecentGifts,
	listUnseenGifts,
	markGiftsSeen,
} = await import('./gifts.ts');
const { seesGiftMoment } = await import('./profile-state.ts');

const actor = (role: 'owner' | 'parent' | 'kid') => ({
	householdId: 'h1',
	userId: 'u1',
	role,
});
const gift = { points: '20', reason: 'Helped Grandma with groceries' };

beforeEach(() => {
	mocks.db.queue.length = 0;
	mocks.db.insert.mockClear();
	mocks.db.values.mockClear();
	mocks.db.execute.mockClear();
	mocks.db.batch.mockReset();
	mocks.db.batch.mockResolvedValue([]);
});

describe('giftPoints', () => {
	it.each(['owner', 'parent'] as const)(
		'lets %s give a kid points as one adjustment row',
		async (role) => {
			mocks.db.queue.push([{ id: 'k1', role: 'kid' }]);
			await giftPoints(actor(role), 'k1', gift);
			expect(mocks.db.values).toHaveBeenCalledOnce();
			expect(mocks.db.values).toHaveBeenCalledWith({
				householdId: 'h1',
				memberId: 'k1',
				delta: 20,
				reason: 'adjustment',
				adjustmentKind: 'gift',
				note: 'Helped Grandma with groceries',
				createdBy: 'u1',
			});
		},
	);

	it('writes the trimmed reason', async () => {
		mocks.db.queue.push([{ id: 'k1', role: 'kid' }]);
		await giftPoints(actor('parent'), 'k1', { ...gift, reason: '  Chores  ' });
		expect(mocks.db.values).toHaveBeenCalledWith(
			expect.objectContaining({ note: 'Chores' }),
		);
	});

	it('refuses a kid actor without reading or writing anything', async () => {
		await expect(giftPoints(actor('kid'), 'k1', gift)).rejects.toThrow(
			'Only a parent can give bonus points.',
		);
		expect(mocks.db.insert).not.toHaveBeenCalled();
	});

	it('reports a member outside the actor household as not found', async () => {
		mocks.db.queue.push([]);
		await expect(giftPoints(actor('parent'), 'x', gift)).rejects.toThrow(
			'That member was not found.',
		);
		expect(mocks.db.insert).not.toHaveBeenCalled();
	});

	it('refuses to gift a parent', async () => {
		mocks.db.queue.push([{ id: 'p2', role: 'parent' }]);
		await expect(giftPoints(actor('owner'), 'p2', gift)).rejects.toBeInstanceOf(
			GiftError,
		);
		expect(mocks.db.insert).not.toHaveBeenCalled();
	});

	it.each([
		{ points: '0', reason: 'x' },
		{ points: '501', reason: 'x' },
		{ points: '-5', reason: 'x' },
		{ points: '1.5', reason: 'x' },
		{ points: 'lots', reason: 'x' },
		{ points: '5', reason: '' },
		{ points: '5', reason: '   ' },
		{ points: '5', reason: 'a'.repeat(141) },
	])('rejects %j before touching the database', async (input) => {
		await expect(
			giftPoints(actor('parent'), 'k1', input),
		).rejects.toBeInstanceOf(GiftError);
		expect(mocks.db.insert).not.toHaveBeenCalled();
	});
});

describe('listRecentGifts', () => {
	it('shapes the rows for the kid', async () => {
		mocks.db.queue.push([
			{
				id: 'g1',
				points: 20,
				reason: 'Chores',
				fromName: 'Mom',
				createdAt: new Date('2026-10-14T12:00:00Z'),
			},
			{
				id: 'g2',
				points: 5,
				reason: 'Report card',
				fromName: null,
				createdAt: new Date('2026-10-12T12:00:00Z'),
			},
		]);
		expect(await listRecentGifts({ id: 'k1', householdId: 'h1' })).toEqual([
			{
				id: 'g1',
				points: 20,
				reason: 'Chores',
				fromName: 'Mom',
				createdAt: '2026-10-14T12:00:00.000Z',
			},
			{
				id: 'g2',
				points: 5,
				reason: 'Report card',
				fromName: null,
				createdAt: '2026-10-12T12:00:00.000Z',
			},
		]);
	});
});

const member = (
	role: 'owner' | 'parent' | 'kid',
	userId: string | null = 'u-kid',
) => ({
	id: 'k1',
	householdId: 'h1',
	userId,
	role,
	displayName: 'Leo',
	avatarColor: null,
	avatarInitial: null,
});
const mom = { ...member('owner', 'u-mom'), id: 'p1', displayName: 'Mom' };
const kidSelf = {
	mode: 'self' as const,
	member: member('kid'),
	actor: member('kid'),
};
const GIFT_A = '0b6f1d1e-6a1c-4c2a-9f1e-2b8d3c4e5f60';
const GIFT_B = '1c7f2e2f-7b2d-4d3b-8f2f-3c9e4d5f6a71';

describe('seesGiftMoment', () => {
	it('is true for a kid on their own login', () => {
		expect(seesGiftMoment(kidSelf)).toBe(true);
	});

	it('is false while a parent is on a kid profile', () => {
		expect(
			seesGiftMoment({ mode: 'kid', member: member('kid', null), actor: mom }),
		).toBe(false);
	});

	it('is false for a parent and without a household', () => {
		expect(seesGiftMoment({ mode: 'self', member: mom, actor: mom })).toBe(
			false,
		);
		expect(seesGiftMoment(null)).toBe(false);
	});
});

describe('listUnseenGifts', () => {
	it('shapes the rows like the Rewards card', async () => {
		mocks.db.queue.push([
			{
				id: 'g1',
				points: 20,
				reason: 'Helped Grandma with groceries',
				fromName: 'Mom',
				createdAt: new Date('2026-10-14T12:00:00Z'),
			},
		]);
		expect(await listUnseenGifts({ id: 'k1', householdId: 'h1' })).toEqual([
			{
				id: 'g1',
				points: 20,
				reason: 'Helped Grandma with groceries',
				fromName: 'Mom',
				createdAt: '2026-10-14T12:00:00.000Z',
			},
		]);
	});
});

describe('markGiftsSeen', () => {
	it('marks them as the kid, in one batch with their claims', async () => {
		await markGiftsSeen(kidSelf, [GIFT_A, GIFT_B]);
		expect(mocks.db.batch).toHaveBeenCalledOnce();
		expect(mocks.db.execute).toHaveBeenCalledTimes(2);
	});

	it('refuses a parent on a kid profile without touching the database', async () => {
		await expect(
			markGiftsSeen({ mode: 'kid', member: member('kid', null), actor: mom }, [
				GIFT_A,
			]),
		).rejects.toMatchObject({ status: 403 });
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});

	it('refuses a parent in their own view', async () => {
		await expect(
			markGiftsSeen({ mode: 'self', member: mom, actor: mom }, [GIFT_A]),
		).rejects.toBeInstanceOf(GiftError);
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});

	it.each([
		[[]],
		['not-a-list'],
		[['nope']],
		[[GIFT_A, 42]],
		[Array.from({ length: 21 }, () => GIFT_A)],
	])('rejects %j before touching the database', async (ids) => {
		await expect(markGiftsSeen(kidSelf, ids)).rejects.toMatchObject({
			status: 400,
		});
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});

	it("turns the database's refusal into a 403", async () => {
		mocks.db.batch.mockRejectedValue(
			Object.assign(new Error('only the member'), { code: '42501' }),
		);
		await expect(markGiftsSeen(kidSelf, [GIFT_A])).rejects.toMatchObject({
			status: 403,
		});
	});
});
