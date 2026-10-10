import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exampleDraft } from '../chore-creator.ts';
import {
	defaultRotationMembers,
	toCreateRotationInput,
} from '../chore-eligibility.ts';
import { setEligible, setReason } from '../rotation-loops.ts';

// The queries themselves can't run here (they need Neon), so this checks what
// createRotationChore builds and that it all goes through one `db.batch`.
// Each insert is recorded as { table, values } instead of being executed.
type Recorded = { table: unknown; values: unknown };
const mocks = vi.hoisted(() => {
	const batch = vi.fn(async (_queries: unknown[]) => []);
	const rows = vi.fn();
	const db = {
		insert: (table: unknown) => ({
			values: (values: unknown) => ({ table, values }),
		}),
		select: () => ({ from: () => ({ where: () => ({ orderBy: rows }) }) }),
		batch,
	};
	return { batch, rows, db };
});
vi.mock('./drizzle.ts', () => ({ db: mocks.db }));

const { createRotationChore, ChoreError } = await import('./chores.ts');
const { choreRotationMembers, choreRotations, choreStages, chores } =
	await import('@chore/db');

const sent = () => mocks.batch.mock.calls[0][0] as Recorded[];

const actor = { householdId: 'h1', userId: 'u1' };
const household = [
	{ id: 'mom', name: 'Mom' },
	{ id: 'dad', name: 'Dad' },
	{ id: 'leo', name: 'Leo' },
	{ id: 'mia', name: 'Mia' },
];

beforeEach(() => {
	mocks.batch.mockClear();
	mocks.rows.mockReset();
	mocks.rows.mockResolvedValue(household);
});

describe('createRotationChore', () => {
	it('writes the chore, stages, rotation, and members in one batch', async () => {
		const input = toCreateRotationInput(
			exampleDraft(),
			defaultRotationMembers(household),
		);
		const { id } = await createRotationChore(actor, input);

		expect(mocks.batch).toHaveBeenCalledTimes(1);
		const queries = sent();
		expect(queries.map((q) => q.table)).toEqual([
			chores,
			choreStages,
			choreStages,
			choreStages,
			choreRotations,
			choreRotationMembers,
		]);
		expect(queries[0].values).toMatchObject({
			id,
			householdId: 'h1',
			type: 'rotation',
			points: 15,
			assignedMemberId: null,
			createdBy: 'u1',
		});
		expect(queries[4].values).toMatchObject({
			choreId: id,
			scope: 'whole_household',
			currentMemberId: 'mom',
		});
		expect(
			(queries[5].values as { memberId: string; position: number }[]).map(
				(m) => [m.memberId, m.position],
			),
		).toEqual([
			['mom', 1],
			['dad', 2],
			['leo', 3],
			['mia', 4],
		]);
	});

	it('gives the first turn to the first eligible member and uses an eligible subset scope', async () => {
		let loop = defaultRotationMembers(household);
		loop = setReason(setEligible(loop, 'mom', false), 'mom', ' On a trip ');
		const { id } = await createRotationChore(
			actor,
			toCreateRotationInput({ ...exampleDraft(), useStages: false }, loop),
		);
		const queries = sent();
		expect(queries).toHaveLength(3);
		expect(queries[1].values).toMatchObject({
			choreId: id,
			scope: 'eligible_subset',
			currentMemberId: 'dad',
		});
		const members = queries[2].values as {
			memberId: string;
			eligible: boolean;
			exclusionReason: string | null;
		}[];
		expect(members[0]).toMatchObject({
			memberId: 'mom',
			eligible: false,
			exclusionReason: 'On a trip',
		});
		expect(members[1].exclusionReason).toBeNull();
	});

	it('refuses with fewer than two eligible members, without touching the database', async () => {
		let loop = defaultRotationMembers(household);
		for (const id of ['dad', 'leo', 'mia']) {
			loop = setReason(setEligible(loop, id, false), id, 'No');
		}
		await expect(
			createRotationChore(actor, toCreateRotationInput(exampleDraft(), loop)),
		).rejects.toBeInstanceOf(ChoreError);
		expect(mocks.batch).not.toHaveBeenCalled();
	});

	it('refuses members that are not this household', async () => {
		const input = toCreateRotationInput(
			exampleDraft(),
			defaultRotationMembers([...household, { id: 'stranger', name: 'X' }]),
		);
		await expect(createRotationChore(actor, input)).rejects.toThrow(
			/changed since/,
		);
		expect(mocks.batch).not.toHaveBeenCalled();
	});
});
