import { beforeEach, describe, expect, it, vi } from 'vitest';

// The statements can't run here (they need Neon), so this checks what
// listHouseholdMembers returns from the rows it reads, and that addManagedKid
// locks and inserts in one `db.batch` and reports a full household.
const mocks = vi.hoisted(() => {
	const queue: unknown[][] = [];
	const select = {
		// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
		then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
		from: () => select,
		where: () => select,
		orderBy: () => select,
	};
	const set = vi.fn((_values: unknown) => ({
		where: vi.fn(async (_condition: unknown) => undefined),
	}));
	const db = {
		queue,
		select: () => select,
		update: vi.fn((_table: unknown) => ({ set })),
		set,
		execute: vi.fn(() => ({ kind: 'execute' })),
		batch: vi.fn(async (_q: unknown[]): Promise<unknown[]> => []),
	};
	return { db };
});
vi.mock('./drizzle.ts', () => ({ db: mocks.db }));

const { addManagedKid, listHouseholdMembers, MemberError, updateMemberAvatar } =
	await import('./members.ts');

const kid = {
	displayName: 'Mia',
	avatarColor: 'blue' as const,
	avatarInitial: null,
	birthYear: 2017,
	weeklyGoalPoints: 200,
};

beforeEach(() => {
	mocks.db.batch.mockReset();
	mocks.db.execute.mockClear();
	mocks.db.queue.length = 0;
	mocks.db.update.mockClear();
	mocks.db.set.mockClear();
});

describe('listHouseholdMembers', () => {
	it('marks members without a login as managed and orders by role', async () => {
		const row = (id: string, role: string, userId: string | null) => ({
			id,
			displayName: id,
			role,
			avatarColor: null,
			birthYear: null,
			userId,
		});
		mocks.db.queue.push([
			row('mia', 'kid', null),
			row('owner', 'owner', 'u1'),
			row('ava', 'kid', 'u3'),
			row('sam', 'parent', 'u2'),
		]);
		const members = await listHouseholdMembers('h1');
		expect(members.map((m) => [m.id, m.managed])).toEqual([
			['owner', false],
			['sam', false],
			['mia', true],
			['ava', false],
		]);
		expect(members[0]).not.toHaveProperty('userId');
	});
});

describe('addManagedKid', () => {
	it('locks the household and inserts in one batch', async () => {
		mocks.db.batch.mockResolvedValue([{}, { rows: [{ id: 'k1' }] }]);
		await addManagedKid('h1', kid);
		expect(mocks.db.batch).toHaveBeenCalledOnce();
		expect(mocks.db.batch.mock.calls[0]?.[0]).toHaveLength(2);
	});

	it('throws a MemberError when the household is at the kid cap', async () => {
		mocks.db.batch.mockResolvedValue([{}, { rows: [] }]);
		await expect(addManagedKid('h1', kid)).rejects.toBeInstanceOf(MemberError);
	});
});

describe('updateMemberAvatar', () => {
	const owner = { id: 'o1', householdId: 'h1', role: 'owner' as const };
	const parent = { id: 'p1', householdId: 'h1', role: 'parent' as const };
	const kidActor = { id: 'k1', householdId: 'h1', role: 'kid' as const };
	const avatar = { avatarColor: '#a1b2c3', avatarInitial: 'MJ' };

	it('lets an owner change a parent', async () => {
		mocks.db.queue.push([{ id: 'p1', role: 'parent' }]);
		await updateMemberAvatar(owner, 'p1', avatar);
		expect(mocks.db.set).toHaveBeenCalledWith(avatar);
	});

	it('lets a parent change a kid and themselves', async () => {
		mocks.db.queue.push([{ id: 'k2', role: 'kid' }]);
		await updateMemberAvatar(parent, 'k2', avatar);
		mocks.db.queue.push([{ id: 'p1', role: 'parent' }]);
		await updateMemberAvatar(parent, 'p1', avatar);
		expect(mocks.db.set).toHaveBeenCalledTimes(2);
	});

	it("refuses a parent changing the owner's or another parent's avatar", async () => {
		mocks.db.queue.push([{ id: 'o1', role: 'owner' }]);
		await expect(
			updateMemberAvatar(parent, 'o1', avatar),
		).rejects.toBeInstanceOf(MemberError);
		mocks.db.queue.push([{ id: 'p2', role: 'parent' }]);
		await expect(
			updateMemberAvatar(parent, 'p2', avatar),
		).rejects.toBeInstanceOf(MemberError);
		expect(mocks.db.update).not.toHaveBeenCalled();
	});

	it('refuses a kid actor', async () => {
		mocks.db.queue.push([{ id: 'k1', role: 'kid' }]);
		await expect(
			updateMemberAvatar(kidActor, 'k1', avatar),
		).rejects.toBeInstanceOf(MemberError);
		expect(mocks.db.update).not.toHaveBeenCalled();
	});

	it('reports a member outside the actor household as not found', async () => {
		mocks.db.queue.push([]);
		await expect(updateMemberAvatar(owner, 'x', avatar)).rejects.toThrow(
			'That member was not found.',
		);
		expect(mocks.db.update).not.toHaveBeenCalled();
	});
});
