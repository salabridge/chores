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
		update: (table: unknown) => ({
			set: () => ({
				where: () => ({ returning: () => ({ kind: 'archive', table }) }),
			}),
		}),
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
	it('archives it last, in the same batch as the inserts', async () => {
		mocks.db.queue.push([{ id: 'mia' }], [{ id: SOURCE }]);
		await createPersonalChore(actor, personalInput(SOURCE));
		expect(mocks.db.batch).toHaveBeenCalledTimes(1);
		expect(sent().map((q) => q.kind)).toEqual([
			'insert',
			'insert',
			'insert',
			'insert',
			'archive',
		]);
		expect(sent()[0].table).toBe(chores);
		expect(sent()[1].table).toBe(choreStages);
		expect(sent()[4].table).toBe(chores);
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

	it('archives it last, in the same batch', async () => {
		mocks.db.queue.push(household, [{ id: SOURCE }]);
		await createRotationChore(actor, rotationInput(SOURCE));
		expect(mocks.db.batch).toHaveBeenCalledTimes(1);
		const kinds = sent().map((q) => q.kind);
		expect(kinds.at(-1)).toBe('archive');
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
