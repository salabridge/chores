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
	};
	return { db };
});
vi.mock('./drizzle.ts', () => ({ db: mocks.db }));

const { GiftError, giftPoints, listRecentGifts, NOT_A_GIFT_NOTE_PREFIXES } =
	await import('./gifts.ts');

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

describe('NOT_A_GIFT_NOTE_PREFIXES', () => {
	it('matches the notes the database writes for a merge and a points move', () => {
		const notGift = (note: string) =>
			NOT_A_GIFT_NOTE_PREFIXES.some((p) => note.startsWith(p));
		// app.merge_household_via_invite (SB-76)
		expect(notGift('Carried over from The Smiths')).toBe(true);
		// app.remove_household_member (SB-84), the credit and the debit
		expect(notGift('Moved from Mia (duplicate profile)')).toBe(true);
		expect(notGift('Moved from Mia to Ava (duplicate profile)')).toBe(true);
		expect(notGift('Helped Grandma with groceries')).toBe(false);
	});
});
