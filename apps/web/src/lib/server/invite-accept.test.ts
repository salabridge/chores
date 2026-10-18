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

const { acceptInvite, InviteAcceptError, inviteProblemOf, loadInvite } =
	await import('./invite-accept.ts');

const { token } = createInviteToken();
const now = new Date('2026-10-18T12:00:00Z');
const row = {
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

describe('inviteProblemOf', () => {
	it('reads the refusal from the error or its cause', () => {
		expect(inviteProblemOf(new Error('invite expired'))).toBe('expired');
		expect(
			inviteProblemOf(
				new Error('Failed query', {
					cause: new Error('invite is for a different email'),
				}),
			),
		).toBe('wrong-email');
		expect(inviteProblemOf(new Error('connection reset'))).toBeNull();
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
		mocks.db.batch.mockRejectedValue(new Error('invite already accepted'));
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
