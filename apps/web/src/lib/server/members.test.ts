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
	const db = {
		queue,
		select: () => select,
		execute: vi.fn(() => ({ kind: 'execute' })),
		batch: vi.fn(async (_q: unknown[]): Promise<unknown[]> => []),
	};
	return { db };
});
vi.mock('./drizzle.ts', () => ({ db: mocks.db }));

const { addManagedKid, listHouseholdMembers, MemberError } = await import(
	'./members.ts'
);

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
