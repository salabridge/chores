import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exampleDraft, toCreateInput } from '../chore-creator.ts';
import {
	defaultRotationMembers,
	toCreateRotationInput,
} from '../chore-eligibility.ts';

// The statements can't run here (they need Neon), so this checks what the
// create sends: with an original to replace, its archive goes in the same
// `db.batch` (one transaction) as the inserts, and when the original isn't
// there nothing is sent at all.
type Recorded = { kind: string; table?: unknown };
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
		insert: (table: unknown) => ({
			values: () => ({ kind: 'insert', table }),
		}),
		execute: () => ({ kind: 'archive' }),
		batch: vi.fn(async (_q: unknown[]) => []),
	};
	return { db };
});
vi.mock('./drizzle.ts', () => ({ db: mocks.db }));

const { createPersonalChore, createRotationChore, ChoreError } = await import(
	'./chores.ts'
);
const { chores, choreStages } = await import('@chore/db');

const actor = { householdId: 'h1', userId: 'u1' };
const SOURCE = '22222222-2222-4222-8222-222222222222';
const household = [
	{ id: 'mia', name: 'Mia' },
	{ id: 'leo', name: 'Leo' },
];

const sent = () => mocks.db.batch.mock.calls[0][0] as Recorded[];
const personalInput = (archiveSourceId?: string) => ({
	...toCreateInput({
		...exampleDraft(),
		kind: 'personal',
		assigneeId: 'mia',
	}),
	archiveSourceId,
});

beforeEach(() => {
	mocks.db.batch.mockClear();
	mocks.db.queue.length = 0;
});

describe('createPersonalChore with an original to archive', () => {
	it('archives it first, in the same batch as the inserts', async () => {
		mocks.db.queue.push([{ id: 'mia' }], [{ id: SOURCE }]);
		await createPersonalChore(actor, personalInput(SOURCE));
		expect(mocks.db.batch).toHaveBeenCalledTimes(1);
		expect(sent().map((q) => q.kind)).toEqual([
			'archive',
			'insert',
			'insert',
			'insert',
			'insert',
		]);
		expect(sent()[1].table).toBe(chores);
		expect(sent()[2].table).toBe(choreStages);
	});

	it('sends nothing, archives nothing, when the original is missing or archived', async () => {
		mocks.db.queue.push([{ id: 'mia' }], []);
		await expect(
			createPersonalChore(actor, personalInput(SOURCE)),
		).rejects.toThrow(ChoreError);
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});

	it('refuses a malformed original id', async () => {
		mocks.db.queue.push([{ id: 'mia' }]);
		await expect(
			createPersonalChore(actor, personalInput('nope')),
		).rejects.toThrow(ChoreError);
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});

	it('leaves the original alone without archiveSourceId', async () => {
		mocks.db.queue.push([{ id: 'mia' }]);
		await createPersonalChore(actor, personalInput());
		expect(sent().some((q) => q.kind === 'archive')).toBe(false);
	});

	it('does not archive when the create itself is refused', async () => {
		await expect(
			createPersonalChore(actor, { ...personalInput(SOURCE), title: '' }),
		).rejects.toThrow(ChoreError);
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});

	it('refuses with the same message when the original is archived after the check', async () => {
		// The read finds the original, then the batch's own archive matches no row
		// (archived or deleted in between): the database aborts the whole batch
		// with division_by_zero, so none of the inserts were written.
		mocks.db.queue.push([{ id: 'mia' }], [{ id: SOURCE }]);
		mocks.db.batch.mockRejectedValueOnce(
			Object.assign(new Error('Failed query'), {
				cause: Object.assign(new Error('division by zero'), { code: '22012' }),
			}),
		);
		await expect(
			createPersonalChore(actor, personalInput(SOURCE)),
		).rejects.toThrow(
			'The chore you are replacing was not found, or is already archived.',
		);
		expect(sent()[0].kind).toBe('archive');
	});

	it('a failing batch propagates (the database rolls it back as a whole)', async () => {
		mocks.db.queue.push([{ id: 'mia' }], [{ id: SOURCE }]);
		mocks.db.batch.mockRejectedValueOnce(new Error('insert failed'));
		await expect(
			createPersonalChore(actor, personalInput(SOURCE)),
		).rejects.toThrow('insert failed');
	});
});

describe('createRotationChore with an original to archive', () => {
	const rotationInput = (archiveSourceId?: string) => ({
		...toCreateRotationInput(exampleDraft(), defaultRotationMembers(household)),
		archiveSourceId,
	});

	it('archives it first, in the same batch', async () => {
		mocks.db.queue.push(household, [{ id: SOURCE }]);
		await createRotationChore(actor, rotationInput(SOURCE));
		expect(mocks.db.batch).toHaveBeenCalledTimes(1);
		const kinds = sent().map((q) => q.kind);
		expect(kinds[0]).toBe('archive');
		expect(kinds.filter((k) => k === 'archive')).toHaveLength(1);
	});

	it('sends nothing when the original is gone', async () => {
		mocks.db.queue.push(household, []);
		await expect(
			createRotationChore(actor, rotationInput(SOURCE)),
		).rejects.toThrow(ChoreError);
		expect(mocks.db.batch).not.toHaveBeenCalled();
	});
});
