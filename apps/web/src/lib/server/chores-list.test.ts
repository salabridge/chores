import { beforeEach, describe, expect, it, vi } from 'vitest';

// The queries can't run here (they need Neon), so this checks how the four
// result sets are put together. Each select takes its rows off a queue, in the
// order loadChoresList issues them.
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

const { loadChoresList } = await import('./chores-list.ts');

beforeEach(() => {
	mocks.queue.length = 0;
	mocks.select.mockClear();
});

const choreRow = (over: Record<string, unknown>) => ({
	id: 'c',
	title: 'Chore',
	type: 'personal',
	frequency: 'daily',
	points: 10,
	assignedMemberId: null,
	archivedAt: null,
	stageCount: 0,
	completed: false,
	...over,
});

describe('loadChoresList', () => {
	it('reads with four selects and attaches each rotation chore its loop', async () => {
		mocks.queue.push(
			[
				choreRow({ id: 'toilet', type: 'rotation', stageCount: 3 }),
				choreRow({ id: 'bed', assignedMemberId: 'mia' }),
				choreRow({ id: 'old', archivedAt: new Date(0), completed: true }),
			],
			[{ choreId: 'toilet', currentMemberId: 'leo' }],
			[
				{ choreId: 'toilet', memberId: 'leo', position: 1, eligible: true },
				{ choreId: 'toilet', memberId: 'mia', position: 2, eligible: false },
			],
			[{ id: 'leo', name: 'Leo', role: 'kid' }],
		);

		const result = await loadChoresList('h1');

		expect(mocks.select).toHaveBeenCalledTimes(4);
		expect(result.members).toEqual([{ id: 'leo', name: 'Leo', role: 'kid' }]);
		const [toilet, bed, old] = result.chores;
		expect(toilet).toMatchObject({
			id: 'toilet',
			currentMemberId: 'leo',
			stageCount: 3,
			archived: false,
			loop: [
				{ memberId: 'leo', position: 1, eligible: true },
				{ memberId: 'mia', position: 2, eligible: false },
			],
		});
		expect(bed).toMatchObject({
			currentMemberId: null,
			loop: [],
			archived: false,
		});
		expect(old).toMatchObject({ archived: true, completed: true });
		expect(old).not.toHaveProperty('archivedAt');
	});
});
