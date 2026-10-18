import { hashInviteToken } from '@chore/db/invites';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The statements can't run here (they need Neon), so this checks what the
// invite functions decide and send: who may invite whom, that a create
// replaces an expired invite and stores only the token's hash in the same
// batch, and that revoke/resend report an invite they couldn't touch.
const mocks = vi.hoisted(() => {
	// Results for awaited selects and `.returning()` calls, in order.
	const queue: unknown[][] = [];
	const recorded: { kind: string; values?: unknown; set?: unknown }[] = [];
	const chain = (record: { kind: string; values?: unknown; set?: unknown }) => {
		recorded.push(record);
		const c: Record<string, unknown> = {
			// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
			then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
			values: (v: unknown) => {
				record.values = v;
				return c;
			},
			set: (v: unknown) => {
				record.set = v;
				return c;
			},
		};
		for (const m of ['from', 'innerJoin', 'where', 'orderBy', 'returning'])
			c[m] = () => c;
		return c;
	};
	const db = {
		queue,
		recorded,
		select: () => chain({ kind: 'select' }),
		insert: () => chain({ kind: 'insert' }),
		delete: () => chain({ kind: 'delete' }),
		update: () => chain({ kind: 'update' }),
		batch: vi.fn(async (_q: unknown[]): Promise<unknown[]> => []),
	};
	return { db };
});
vi.mock('./drizzle.ts', () => ({ db: mocks.db }));

const { createInvite, resendInvite, revokeInvite } = await import(
	'./invites.ts'
);
const { MemberError } = await import('./members.ts');

const owner = { householdId: 'h1', role: 'owner' as const, userId: 'u1' };
const parent = { householdId: 'h1', role: 'parent' as const, userId: 'u2' };
const kidInvite = {
	role: 'kid' as const,
	email: 'ava@example.com',
	displayName: 'Ava',
	birthYear: 2010,
};
const parentInvite = {
	role: 'parent' as const,
	email: 'sam@example.com',
	displayName: null,
	birthYear: null,
};

beforeEach(() => {
	mocks.db.batch.mockReset();
	mocks.db.queue.length = 0;
	mocks.db.recorded.length = 0;
});

describe('createInvite', () => {
	it('stops a parent from inviting a parent before touching the database', async () => {
		await expect(createInvite(parent, parentInvite)).rejects.toThrow(
			'Only the household owner can invite a parent.',
		);
		expect(mocks.db.recorded).toHaveLength(0);
	});

	it('refuses an email that already belongs to a member', async () => {
		mocks.db.queue.push([{ id: 'm1' }]);
		await expect(createInvite(owner, kidInvite)).rejects.toBeInstanceOf(
			MemberError,
		);
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});

	it('replaces an expired invite and stores only the hash, in one batch', async () => {
		mocks.db.queue.push([]);
		const token = await createInvite(parent, kidInvite);
		expect(mocks.db.batch).toHaveBeenCalledOnce();
		const kinds = mocks.db.recorded.map((r) => r.kind);
		expect(kinds).toEqual(['select', 'delete', 'insert']);
		const insert = mocks.db.recorded[2]?.values as Record<string, unknown>;
		expect(insert).toMatchObject({
			householdId: 'h1',
			role: 'kid',
			email: 'ava@example.com',
			birthYear: 2010,
			invitedBy: 'u2',
			tokenHash: hashInviteToken(token),
		});
		expect(JSON.stringify(insert)).not.toContain(token);
	});

	it('reports a live invite for the same email', async () => {
		mocks.db.queue.push([]);
		mocks.db.batch.mockRejectedValue(
			Object.assign(new Error('dup'), { code: '23505' }),
		);
		await expect(createInvite(owner, parentInvite)).rejects.toThrow(
			'sam@example.com already has a pending invite. Resend it instead.',
		);
	});
});

describe('revokeInvite', () => {
	it('succeeds when a row was deleted', async () => {
		mocks.db.queue.push([{ id: 'i1' }]);
		await expect(revokeInvite(owner, 'i1')).resolves.toBeUndefined();
	});

	it('reports an invite it could not delete', async () => {
		mocks.db.queue.push([]);
		await expect(revokeInvite(parent, 'i1')).rejects.toThrow(
			'That invite was not found.',
		);
	});
});

describe('resendInvite', () => {
	it('stores a new hash and returns the new token', async () => {
		mocks.db.queue.push([{ id: 'i1' }]);
		const token = await resendInvite(owner, 'i1');
		const set = mocks.db.recorded[0]?.set as { tokenHash: string };
		expect(set.tokenHash).toBe(hashInviteToken(token));
	});

	it('reports an invite it could not update', async () => {
		mocks.db.queue.push([]);
		await expect(resendInvite(parent, 'i1')).rejects.toBeInstanceOf(
			MemberError,
		);
	});
});
