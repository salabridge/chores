import { beforeEach, describe, expect, it, vi } from 'vitest';

// The queries can't run here (they need Neon). Each select takes its rows off
// a queue, in the order the code issues them; the household scoping itself is
// the where clause's, so what's checked is what the loader returns for rows
// the database did or didn't give back.
const mocks = vi.hoisted(() => {
	const queue: unknown[][] = [];
	const chain: Record<string, unknown> = {
		// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
		then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
	};
	for (const m of ['from', 'where', 'orderBy']) chain[m] = () => chain;
	return { queue, select: vi.fn(() => chain) };
});
vi.mock('./drizzle.ts', () => ({ db: mocks }));

const { loadDuplicateSource } = await import('./chore-duplicate.ts');

const ID = '11111111-1111-4111-8111-111111111111';
const choreRow = {
	id: ID,
	title: 'Bathroom',
	description: 'Wipe it',
	type: 'rotation',
	frequency: 'daily',
	points: 15,
	assignedMemberId: null,
};

beforeEach(() => {
	mocks.queue.length = 0;
	mocks.select.mockClear();
});

describe('loadDuplicateSource', () => {
	it('returns null without querying for a malformed id', async () => {
		expect(await loadDuplicateSource('h1', 'not-a-uuid')).toBeNull();
		expect(mocks.select).not.toHaveBeenCalled();
	});

	it('returns null when no active chore of the household matches', async () => {
		// Missing, another household's and archived chores all come back empty.
		mocks.queue.push([]);
		expect(await loadDuplicateSource('h1', ID)).toBeNull();
		expect(mocks.select).toHaveBeenCalledTimes(1);
	});

	it('reads a rotation with its stages and whose turn it is', async () => {
		mocks.queue.push(
			[choreRow],
			[{ title: 'Sink', hint: null }],
			[{ currentMemberId: 'mia' }],
		);
		expect(await loadDuplicateSource('h1', ID)).toEqual({
			id: ID,
			title: 'Bathroom',
			note: 'Wipe it',
			kind: 'rotation',
			frequency: 'daily',
			points: 15,
			stages: [{ title: 'Sink', hint: null }],
			assigneeId: null,
			currentTurnMemberId: 'mia',
		});
	});

	it('does not read a rotation row for a personal chore', async () => {
		mocks.queue.push(
			[{ ...choreRow, type: 'personal', assignedMemberId: 'leo' }],
			[],
		);
		const source = await loadDuplicateSource('h1', ID);
		expect(mocks.select).toHaveBeenCalledTimes(2);
		expect(source).toMatchObject({
			kind: 'personal',
			assigneeId: 'leo',
			currentTurnMemberId: null,
		});
	});
});
