import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	choreToDraft,
	STALE_CHORE_MESSAGE,
	toUpdateInput,
} from '../chore-creator.ts';

// The queries themselves can't run here (they need Neon), so this checks what
// updateChoreFromInput decides and what it sends. Selects come off a queue (one
// result per awaited query, in the order the code issues them); writes are
// recorded instead of executed, and everything goes through one `db.batch`.
type Recorded = {
	op: 'update' | 'delete' | 'execute';
	table?: unknown;
	set?: Record<string, unknown>;
};
const mocks = vi.hoisted(() => {
	const queue: unknown[][] = [];
	const select = vi.fn(() => {
		const chain: Record<string, unknown> = {
			// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
			then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
		};
		for (const m of ['from', 'where', 'orderBy', 'limit'])
			chain[m] = () => chain;
		return chain;
	});
	const update = (table: unknown) => ({
		set: (set: Record<string, unknown>) => ({
			where: () => {
				const record = {
					op: 'update',
					table,
					set,
					returning: () => record,
				};
				return record;
			},
		}),
	});
	const del = (table: unknown) => ({
		where: () => ({ op: 'delete', table }),
	});
	const execute = vi.fn(() => ({ op: 'execute' }));
	const batch = vi.fn(
		async (_queries: unknown[]): Promise<unknown[]> => [[{ id: 'c1' }]],
	);
	return { queue, select, update, delete: del, execute, batch };
});
vi.mock('./drizzle.ts', () => ({ db: mocks }));
vi.mock('./household-today.ts', () => ({
	householdToday: async () => '2026-10-13',
}));

const { ChoreError, updateChoreFromInput } = await import('./chores.ts');
const { choreInstances, choreStages, chores } = await import('@chore/db');

const CHORE = '11111111-1111-4111-8111-111111111111';
const S1 = '22222222-2222-4222-8222-222222222221';
const S2 = '22222222-2222-4222-8222-222222222222';
const S3 = '22222222-2222-4222-8222-222222222223';
const LOADED = new Date('2026-10-13T08:00:00.123Z');

const actor = { householdId: 'h1' };

const choreRow = (over: Record<string, unknown> = {}) => ({
	id: CHORE,
	householdId: 'h1',
	title: 'Clean Your Room',
	description: null,
	type: 'personal',
	points: 10,
	frequency: 'daily',
	assignedMemberId: 'leo',
	updatedAt: LOADED,
	...over,
});
const stageRows = [
	{ id: S1, title: 'Toys', hint: null, position: 1 },
	{ id: S2, title: 'Dust', hint: null, position: 2 },
	{ id: S3, title: 'Vacuum', hint: null, position: 3 },
];

/** Queues what the code reads: the chore, its stages, then (personal) the assignee. */
function saved(
	chore: Record<string, unknown> = {},
	stages = stageRows,
	assignee: { id: string } | null = { id: 'leo' },
) {
	mocks.queue.push([choreRow(chore)], stages);
	if (choreRow(chore).type === 'personal') {
		mocks.queue.push(assignee ? [assignee] : []);
	}
}

/** What the form would send after loading the saved chore and applying `edit`. */
function input(edit: (d: ReturnType<typeof choreToDraft>) => void = () => {}) {
	const draft = choreToDraft({
		...choreRow(),
		type: 'personal',
		frequency: 'daily',
		stages: stageRows,
	} as never);
	edit(draft);
	return toUpdateInput(draft, CHORE, LOADED.toISOString());
}

const sent = () => mocks.batch.mock.calls[0][0] as Recorded[];

beforeEach(() => {
	mocks.queue.length = 0;
	mocks.batch.mockClear();
	mocks.select.mockClear();
	mocks.batch.mockResolvedValue([[{ id: CHORE }]]);
	mocks.execute.mockClear();
});

describe('updateChoreFromInput', () => {
	it('updates the chore row alone when only its fields change', async () => {
		saved();
		const { id } = await updateChoreFromInput(
			actor,
			input((d) => {
				d.title = ' Tidy Your Room ';
				d.note = 'Under the bed too';
				d.points = 20;
				d.frequency = 'weekly';
			}),
		);
		expect(id).toBe(CHORE);
		expect(mocks.batch).toHaveBeenCalledTimes(1);
		const queries = sent();
		expect(queries).toHaveLength(1);
		expect(queries[0].table).toBe(chores);
		expect(queries[0].set).toMatchObject({
			title: 'Tidy Your Room',
			description: 'Under the bed too',
			points: 20,
			frequency: 'weekly',
			assignedMemberId: 'leo',
		});
		// A new, later stamp is what the next save has to match.
		expect(
			(queries[0].set as { updatedAt: Date }).updatedAt.getTime(),
		).toBeGreaterThan(LOADED.getTime());
	});

	it('saves stages as a diff: delete, park the movers, then place, then insert', async () => {
		saved();
		// S2 removed; S3 renamed and moved to 1; S1 moved to 2; a new stage third.
		await updateChoreFromInput(
			actor,
			input((d) => {
				const [s1, , s3] = d.stages;
				d.stages = [
					{ ...s3, title: 'Vacuum floor' },
					s1,
					{ key: 'new', title: 'Make bed', hint: 'Tuck the corners' },
				];
			}),
		);
		const queries = sent();
		expect(queries.map((q) => [q.op, q.table])).toEqual([
			['update', chores],
			['delete', choreStages],
			['update', choreStages], // park S3
			['update', choreStages], // park S1
			['update', choreStages], // S3 -> 1, renamed
			['update', choreStages], // S1 -> 2
			['execute', undefined], // the new stage
		]);
		expect(queries.slice(2, 4).map((q) => q.set)).toEqual([
			{ position: 1001 },
			{ position: 1002 },
		]);
		expect(queries.slice(4, 6).map((q) => q.set)).toEqual([
			{ position: 1, title: 'Vacuum floor', hint: null },
			{ position: 2, title: 'Toys', hint: null },
		]);
	});

	it('leaves untouched stages alone, so their progress survives', async () => {
		saved();
		await updateChoreFromInput(
			actor,
			input((d) => {
				d.stages[1].title = 'Dust and wipe';
			}),
		);
		const queries = sent();
		expect(queries).toHaveLength(2);
		expect(queries[1].set).toEqual({
			position: 2,
			title: 'Dust and wipe',
			hint: null,
		});
	});

	it('refuses a stage id that is not this chore', async () => {
		saved();
		await expect(
			updateChoreFromInput(
				actor,
				input((d) => {
					d.stages[0] = {
						...d.stages[0],
						id: 'aaaaaaaa-0000-4000-8000-000000000000',
					};
				}),
			),
		).rejects.toThrow(/out of date/);
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('hands this period to a new assignee only if it is not done', async () => {
		saved({}, stageRows, { id: 'mia' });
		await updateChoreFromInput(
			actor,
			input((d) => {
				d.assigneeId = 'mia';
			}),
		);
		const queries = sent();
		expect(queries.map((q) => q.table)).toEqual([chores, choreInstances]);
		expect(queries[0].set).toMatchObject({ assignedMemberId: 'mia' });
		expect(queries[1].set).toEqual({ assignedMemberId: 'mia' });
	});

	it('does not touch instances when the assignee is unchanged', async () => {
		saved();
		await updateChoreFromInput(actor, input());
		expect(sent().map((q) => q.table)).toEqual([chores]);
	});

	it('refuses an assignee outside the household', async () => {
		saved({}, stageRows, null);
		await expect(
			updateChoreFromInput(
				actor,
				input((d) => {
					d.assigneeId = 'stranger';
				}),
			),
		).rejects.toThrow(/member of this household/);
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('rejects a stale form with the reload message, writing nothing', async () => {
		saved({ updatedAt: new Date(LOADED.getTime() + 5000) });
		const error = await updateChoreFromInput(actor, input()).catch((e) => e);
		expect(error).toBeInstanceOf(ChoreError);
		expect(error.message).toBe(STALE_CHORE_MESSAGE);
		expect(error.status).toBe(409);
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('rejects when someone saves between the check and the batch', async () => {
		saved();
		mocks.batch.mockResolvedValue([[]]);
		const error = await updateChoreFromInput(actor, input()).catch((e) => e);
		expect(error).toBeInstanceOf(ChoreError);
		expect(error.message).toBe(STALE_CHORE_MESSAGE);
		expect(error.status).toBe(409);
	});

	it('404s for a chore outside the household, without writing', async () => {
		// The household-scoped lookup finds nothing.
		mocks.queue.push([]);
		const error = await updateChoreFromInput(actor, input()).catch((e) => e);
		expect(error).toBeInstanceOf(ChoreError);
		expect(error.status).toBe(404);
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('404s for an id that is not a uuid, without querying', async () => {
		const bad = { ...input(), choreId: 'not-an-id' };
		const error = await updateChoreFromInput(actor, bad).catch((e) => e);
		expect(error.status).toBe(404);
		expect(mocks.select).not.toHaveBeenCalled();
	});

	it('refuses to change the type', async () => {
		saved({ type: 'rotation', assignedMemberId: null });
		await expect(updateChoreFromInput(actor, input())).rejects.toThrow(
			/can't change/,
		);
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('runs the same validation as creating', async () => {
		await expect(
			updateChoreFromInput(
				actor,
				input((d) => {
					d.title = ' ';
				}),
			),
		).rejects.toThrow(/title/);
		expect(mocks.select).not.toHaveBeenCalled();
	});
});
