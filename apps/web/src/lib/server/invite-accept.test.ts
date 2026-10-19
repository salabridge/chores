import { createInviteToken } from '@chore/db/invites';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The statements can't run here (they need Neon), so this checks how the
// lookup reads its row, and that accepting sets the user's claims and calls
// the database function in one batch, turning its refusals into problems.
const mocks = vi.hoisted(() => {
	const queue: unknown[][] = [];
	const select = {
		// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
		then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
		from: () => select,
		innerJoin: () => select,
		leftJoin: () => select,
		where: () => select,
		orderBy: () => select,
		limit: () => select,
	};
	const db = {
		queue,
		select: vi.fn(() => select),
		execute: vi.fn((query: unknown) => query),
		batch: vi.fn(async (_q: unknown[]): Promise<unknown[]> => []),
	};
	return { db };
});
vi.mock('./drizzle.ts', () => ({ db: mocks.db }));

const {
	acceptInvite,
	InviteAcceptError,
	inviteProblemOf,
	leaveHousehold,
	loadCurrentHousehold,
	loadInvite,
	mergeHouseholdViaInvite,
	readInvite,
} = await import('./invite-accept.ts');

const { token } = createInviteToken();
const now = new Date('2026-10-18T12:00:00Z');
const row = {
	householdId: 'h1',
	email: 'ava@example.com',
	role: 'kid',
	expiresAt: new Date('2026-10-20T12:00:00Z'),
	acceptedAt: null,
	householdName: 'Burbridge Household',
	inviterName: 'Jim',
};

beforeEach(() => {
	mocks.db.queue.length = 0;
	mocks.db.select.mockClear();
	mocks.db.batch.mockReset();
});

describe('loadInvite', () => {
	it("doesn't query for a token that can't be one", async () => {
		expect(await loadInvite('nope', now)).toEqual({ status: 'not-found' });
		expect(mocks.db.select).not.toHaveBeenCalled();
	});

	it('describes an open invite', async () => {
		mocks.db.queue.push([row]);
		expect(await loadInvite(token, now)).toEqual({
			status: 'open',
			email: 'ava@example.com',
			role: 'kid',
			householdName: 'Burbridge Household',
			inviterName: 'Jim',
		});
	});

	it("keeps the open invite's household on the server side", async () => {
		mocks.db.queue.push([row], [{ ...row, acceptedAt: new Date() }]);
		expect((await readInvite(token, now)).householdId).toBe('h1');
		expect(await readInvite(token, now)).toEqual({
			view: { status: 'accepted' },
			householdId: null,
		});
		mocks.db.queue.push([row]);
		expect(await loadInvite(token, now)).not.toHaveProperty('householdId');
	});

	it('reports unknown, used and expired invites', async () => {
		mocks.db.queue.push(
			[],
			[{ ...row, acceptedAt: new Date() }],
			[{ ...row, expiresAt: now }],
		);
		expect(await loadInvite(token, now)).toEqual({ status: 'not-found' });
		expect(await loadInvite(token, now)).toEqual({ status: 'accepted' });
		expect(await loadInvite(token, now)).toEqual({ status: 'expired' });
	});
});

const refusal = (hint: string, code = 'P0001') =>
	Object.assign(new Error('refused'), { hint, code });

describe('inviteProblemOf', () => {
	it("reads the refusal from the error's hint or its cause's", () => {
		expect(inviteProblemOf(refusal('invite-expired', '22023'))).toBe('expired');
		expect(
			inviteProblemOf(
				new Error('Failed query', { cause: refusal('wrong-email', '42501') }),
			),
		).toBe('wrong-email');
		expect(inviteProblemOf(refusal('already-in-household'))).toBe(
			'already-in-household',
		);
		expect(inviteProblemOf(refusal('household-full'))).toBe('household-full');
	});

	it("maps the merge function's refusals", () => {
		expect(inviteProblemOf(refusal('not-owner', '42501'))).toBe('not-owner');
		expect(inviteProblemOf(refusal('same-household', '22023'))).toBe(
			'same-household',
		);
	});

	it('ignores the message text, which is not a contract', () => {
		expect(inviteProblemOf(new Error('invite expired'))).toBeNull();
		expect(inviteProblemOf(new Error('connection reset'))).toBeNull();
	});

	it('treats a unique violation as already being a member', () => {
		expect(
			inviteProblemOf(
				new Error('Failed query', {
					cause: Object.assign(new Error('duplicate key'), { code: '23505' }),
				}),
			),
		).toBe('already-member');
	});
});

describe('acceptInvite', () => {
	it('sets the claims and accepts in one batch', async () => {
		mocks.db.batch.mockResolvedValue([{}, { rows: [{ member_id: 'm9' }] }]);
		expect(await acceptInvite('u1', token)).toBe('m9');
		const [statements] = mocks.db.batch.mock.calls[0] ?? [];
		expect(statements).toHaveLength(2);
		expect(JSON.stringify(statements?.[0])).toContain('{\\"sub\\":\\"u1\\"}');
	});

	it('turns a refusal into an InviteAcceptError', async () => {
		mocks.db.batch.mockRejectedValue(refusal('invite-accepted', '22023'));
		await expect(acceptInvite('u1', token)).rejects.toMatchObject({
			problem: 'accepted',
		});
		await expect(acceptInvite('u1', 'bad')).rejects.toBeInstanceOf(
			InviteAcceptError,
		);
	});

	it('lets other errors through', async () => {
		mocks.db.batch.mockRejectedValue(new Error('connection reset'));
		await expect(acceptInvite('u1', token)).rejects.toThrow('connection reset');
	});
});

const householdId = '00000000-0000-4000-8000-000000000001';

describe('mergeHouseholdViaInvite', () => {
	it('sets the claims and merges in one batch', async () => {
		mocks.db.batch.mockResolvedValue([{}, { rows: [{ member_id: 'm9' }] }]);
		expect(await mergeHouseholdViaInvite('u1', token, householdId)).toBe('m9');
		const [statements] = mocks.db.batch.mock.calls[0] ?? [];
		expect(statements).toHaveLength(2);
		expect(JSON.stringify(statements?.[0])).toContain('{\\"sub\\":\\"u1\\"}');
		expect(JSON.stringify(statements?.[1])).toContain(
			'app.merge_household_via_invite',
		);
	});

	it('refuses a bad token or household id without asking the database', async () => {
		await expect(
			mergeHouseholdViaInvite('u1', 'bad', householdId),
		).rejects.toMatchObject({ problem: 'not-found' });
		await expect(
			mergeHouseholdViaInvite('u1', token, 'not-a-uuid'),
		).rejects.toMatchObject({ problem: 'not-owner' });
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});

	it('turns a refusal into an InviteAcceptError', async () => {
		mocks.db.batch.mockRejectedValue(
			new Error('Failed query', { cause: refusal('household-full') }),
		);
		await expect(
			mergeHouseholdViaInvite('u1', token, householdId),
		).rejects.toMatchObject({ problem: 'household-full' });
	});
});

describe('leaveHousehold', () => {
	it('locks the household, clears kid profiles and leaves in one batch', async () => {
		mocks.db.batch.mockResolvedValue([{}, {}, { rows: [{ id: 'm1' }] }]);
		expect(await leaveHousehold('u1', householdId)).toBe(true);
		const [statements] = mocks.db.batch.mock.calls[0] ?? [];
		expect(statements).toHaveLength(3);
		const [lock, devices, remove] = (statements ?? []).map((s) =>
			JSON.stringify(s),
		);
		expect(lock).toContain('for update');
		expect(devices).toContain('device_profiles');
		expect(remove).toContain('delete from household_members');
		// Only their own row, and never the only owner.
		expect(remove).toContain('m.user_id = ');
		expect(remove).toContain("o.role = 'owner'");
	});

	it('reports when nothing was removed', async () => {
		mocks.db.batch.mockResolvedValue([{}, {}, { rows: [] }]);
		expect(await leaveHousehold('u1', householdId)).toBe(false);
		expect(await leaveHousehold('u1', 'nope')).toBe(false);
	});
});

describe('loadCurrentHousehold', () => {
	it('is null when the user has no household', async () => {
		mocks.db.queue.push([]);
		expect(await loadCurrentHousehold('u1')).toBeNull();
	});

	it('tells a non-owner only which household it is', async () => {
		mocks.db.queue.push([{ id: 'h2', name: 'Pat Place', role: 'parent' }]);
		expect(await loadCurrentHousehold('u1')).toEqual({
			id: 'h2',
			name: 'Pat Place',
			role: 'parent',
			merge: null,
		});
		expect(mocks.db.select).toHaveBeenCalledOnce();
	});

	it('tells an owner what moves and what is deleted', async () => {
		mocks.db.queue.push(
			[{ id: 'h2', name: 'Pat Place', role: 'owner' }],
			[
				{ displayName: 'Pat', userId: 'u1', points: 0 },
				{ displayName: 'Mia', userId: null, points: 24 },
			],
			[{ chores: 6, rewards: 2, completions: 41 }],
		);
		expect(await loadCurrentHousehold('u1')).toEqual({
			id: 'h2',
			name: 'Pat Place',
			role: 'owner',
			merge: {
				members: [
					{ displayName: 'Pat', points: 0, you: true },
					{ displayName: 'Mia', points: 24, you: false },
				],
				chores: 6,
				rewards: 2,
				completions: 41,
			},
		});
	});
});
