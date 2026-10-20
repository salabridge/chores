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
		execute: vi.fn((query: { queryChunks?: unknown[] }) => ({
			kind: 'execute',
			sql: JSON.stringify(query.queryChunks ?? query),
		})),
		batch: vi.fn(async (_q: unknown[]): Promise<unknown[]> => []),
	};
	return { db };
});
vi.mock('./drizzle.ts', () => ({ db: mocks.db }));

const {
	addManagedKid,
	listHouseholdMembers,
	MemberError,
	removeMember,
	updateMemberAvatar,
} = await import('./members.ts');

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

describe('removeMember', () => {
	const MIA = '11111111-1111-4111-8111-111111111111';
	const AVA = '22222222-2222-4222-8222-222222222222';
	const mom = {
		id: 'mom',
		householdId: 'h1',
		userId: 'mom-user',
		role: 'owner' as const,
		displayName: 'Mom',
		avatarColor: null,
		avatarInitial: null,
	};
	const self = { mode: 'self' as const, member: mom, actor: mom };
	const household = [
		{ id: MIA, name: 'Mia' },
		{ id: AVA, name: 'Ava' },
	];
	const failure = async (run: () => Promise<unknown>) => {
		try {
			await run();
		} catch (e) {
			return e;
		}
		throw new Error('expected a rejection');
	};

	it('removes in one batch as the signed-in parent and reports the move', async () => {
		mocks.db.queue.push(household);
		mocks.db.batch.mockResolvedValueOnce([[], { rows: [{ moved: 15 }] }]);
		expect(await removeMember(self, MIA, AVA)).toEqual({
			name: 'Mia',
			movedPoints: 15,
			movedTo: 'Ava',
		});
		const queries = mocks.db.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[0].sql).toContain('request.jwt.claims');
		expect(queries[0].sql).toContain('mom-user');
		expect(queries[1].sql).toContain('app.remove_household_member');
		expect(queries[1].sql).toContain(MIA);
		expect(queries[1].sql).toContain(AVA);
	});

	it('says nothing moved when the balance was 0', async () => {
		mocks.db.queue.push(household);
		mocks.db.batch.mockResolvedValueOnce([[], { rows: [{ moved: 0 }] }]);
		expect(await removeMember(self, MIA, AVA)).toEqual({
			name: 'Mia',
			movedPoints: 0,
			movedTo: null,
		});
	});

	it('passes a kid profile as acting_as, so the database refuses it', async () => {
		const mia = { ...mom, id: MIA, userId: null, role: 'kid' as const };
		mocks.db.queue.push(household);
		mocks.db.batch.mockResolvedValueOnce([[], { rows: [{ moved: 0 }] }]);
		await removeMember({ mode: 'kid', member: mia, actor: mom }, AVA, null);
		const queries = mocks.db.batch.mock.calls[0][0] as { sql: string }[];
		expect(queries[1].sql.split(MIA).length).toBe(2);
	});

	it('never calls the database for someone outside the household', async () => {
		mocks.db.queue.push(household);
		const e = await failure(() =>
			removeMember(self, '33333333-3333-4333-8333-333333333333', null),
		);
		expect(e).toBeInstanceOf(MemberError);
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});

	it("words the database's refusals by their HINT", async () => {
		const cases: [string, string][] = [
			['self', "You can't remove yourself."],
			['not-owner', 'Only an owner can remove a parent.'],
			['last-owner', "The household's only owner can't be removed."],
			['kid-profile', 'A parent has to leave this kid profile first.'],
			[
				'invalid-recipient',
				'Points can only move to another kid in the household.',
			],
		];
		for (const [hint, message] of cases) {
			mocks.db.queue.push(household);
			mocks.db.batch.mockRejectedValueOnce(
				new Error('wrapped', {
					cause: Object.assign(new Error('pg'), { code: '42501', hint }),
				}),
			);
			const e = await failure(() => removeMember(self, MIA, null));
			expect(e).toBeInstanceOf(MemberError);
			expect((e as Error).message).toBe(message);
		}
	});
});
