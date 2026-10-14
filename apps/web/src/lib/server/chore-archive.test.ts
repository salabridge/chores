import { beforeEach, describe, expect, it, vi } from 'vitest';

// The statements themselves can't run here (they need Neon), so this checks
// what archive/restore/delete decide and send. Each statement takes its result
// off a queue (one per query, in the order the code issues them); the
// statement kind and its where clause are recorded.
const mocks = vi.hoisted(() => {
	// A queued Error is thrown when the statement is awaited.
	const queue: (unknown[] | Error)[] = [];
	const statements: { kind: string; set?: unknown; where?: unknown }[] = [];
	const builder = (kind: string) => {
		const record: { kind: string; set?: unknown; where?: unknown } = { kind };
		statements.push(record);
		const chain: Record<string, unknown> = {
			// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
			then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
				const next = queue.shift() ?? [];
				if (next instanceof Error) reject(next);
				else resolve(next);
			},
			set: (v: unknown) => {
				record.set = v;
				return chain;
			},
			where: (v: unknown) => {
				record.where = v;
				return chain;
			},
		};
		for (const m of ['from', 'returning']) chain[m] = () => chain;
		return chain;
	};
	return {
		queue,
		statements,
		update: vi.fn(() => builder('update')),
		delete: vi.fn(() => builder('delete')),
		select: vi.fn(() => builder('select')),
	};
});
vi.mock('./drizzle.ts', () => ({ db: mocks }));

const { ChoreArchiveError, archiveChore, deleteChore, restoreChore } =
	await import('./chore-archive.ts');

const CHORE_ID = '11111111-1111-4111-8111-111111111111';

const failure = async (run: () => Promise<unknown>) => {
	try {
		await run();
	} catch (e) {
		return e;
	}
	return undefined;
};

// Drizzle SQL objects are cyclic through their columns, so stringify only the
// raw text chunks.
const sqlText = (node: unknown, seen = new Set<unknown>()): string => {
	if (typeof node !== 'object' || node === null || seen.has(node)) return '';
	seen.add(node);
	const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
	const value = (node as { value?: unknown }).value;
	return [
		Array.isArray(value) ? value.join('') : '',
		...(chunks ?? []).map((c) => sqlText(c, seen)),
	].join(' ');
};

beforeEach(() => {
	mocks.queue.length = 0;
	mocks.statements.length = 0;
});

describe('archiveChore', () => {
	it('stamps archived_at on a live chore in the household', async () => {
		mocks.queue.push([{ id: CHORE_ID }]);
		await archiveChore('h1', CHORE_ID);
		const [statement] = mocks.statements;
		expect(statement?.kind).toBe('update');
		expect(statement?.set).toEqual({ archivedAt: expect.any(Date) });
		expect(sqlText(statement?.where)).toContain('is null');
	});

	it('is a 404 when nothing matched: wrong household, missing, or already archived', async () => {
		mocks.queue.push([]);
		const e = await failure(() => archiveChore('h2', CHORE_ID));
		expect(e).toBeInstanceOf(ChoreArchiveError);
		expect((e as { status: number; message: string }).status).toBe(404);
	});

	it('never deletes anything', async () => {
		mocks.queue.push([{ id: CHORE_ID }]);
		await archiveChore('h1', CHORE_ID);
		expect(mocks.delete).not.toHaveBeenCalled();
	});
});

describe('restoreChore', () => {
	it('clears archived_at on an archived chore', async () => {
		mocks.queue.push([{ id: CHORE_ID }]);
		await restoreChore('h1', CHORE_ID);
		const [statement] = mocks.statements;
		expect(statement?.set).toEqual({ archivedAt: null });
		expect(sqlText(statement?.where)).toContain('is not null');
	});

	it('is a 404 for a chore that is not archived', async () => {
		mocks.queue.push([]);
		const e = await failure(() => restoreChore('h1', CHORE_ID));
		expect((e as { status: number; message: string }).status).toBe(404);
	});
});

describe('deleteChore', () => {
	it('deletes a never-completed chore, with the completions check in the same statement', async () => {
		mocks.queue.push([{ id: CHORE_ID }]);
		await deleteChore('h1', CHORE_ID);
		expect(mocks.statements).toHaveLength(1);
		const [statement] = mocks.statements;
		expect(statement?.kind).toBe('delete');
		expect(sqlText(statement?.where)).toContain('not exists');
		expect(sqlText(statement?.where)).toContain('select 1 from');
	});

	it('is refused with a message once the chore has a completion', async () => {
		// The DELETE matched nothing, then the chore turns out to exist.
		mocks.queue.push([], [{ id: CHORE_ID }]);
		const e = await failure(() => deleteChore('h1', CHORE_ID));
		expect(e).toBeInstanceOf(ChoreArchiveError);
		expect((e as { status: number; message: string }).status).toBe(409);
		expect((e as { status: number; message: string }).message).toMatch(
			/Archive it instead/,
		);
	});

	it('is refused when a completion lands between the page load and the delete', async () => {
		// Nothing is read first, so there is no window: the guard is the DELETE's
		// own where clause, and a completion committed before it runs makes it
		// match no rows.
		mocks.queue.push([], [{ id: CHORE_ID }]);
		await expect(deleteChore('h1', CHORE_ID)).rejects.toMatchObject({
			status: 409,
		});
		expect(mocks.statements.map((s) => s.kind)).toEqual(['delete', 'select']);
	});

	it('is refused when the database rejects the delete (a completion committed mid-statement)', async () => {
		// The NOT EXISTS subquery missed an in-flight completion; the NO ACTION
		// foreign keys catch it, and the driver may wrap the error.
		const fk = Object.assign(new Error('violates foreign key constraint'), {
			code: '23503',
		});
		mocks.queue.push(new Error('Failed query', { cause: fk }));
		await expect(deleteChore('h1', CHORE_ID)).rejects.toMatchObject({
			status: 409,
			message: expect.stringMatching(/Archive it instead/),
		});
		expect(mocks.statements.map((s) => s.kind)).toEqual(['delete']);
	});

	it('rethrows any other database error', async () => {
		mocks.queue.push(new Error('connection reset'));
		await expect(deleteChore('h1', CHORE_ID)).rejects.toThrow(
			'connection reset',
		);
	});

	it('is a 404 for a chore that does not exist in the household', async () => {
		mocks.queue.push([], []);
		const e = await failure(() => deleteChore('h2', CHORE_ID));
		expect((e as { status: number; message: string }).status).toBe(404);
	});
});
