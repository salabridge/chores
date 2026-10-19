import { beforeEach, describe, expect, it, vi } from 'vitest';

// The queries can't run here (they need Neon), so selects come off a queue,
// one result per query in the order loadToday issues them: chores, members,
// rotations, loop members, stages, skips, then the period's instances and
// stage progress.
const mocks = vi.hoisted(() => {
	const queue: unknown[][] = [];
	const select = vi.fn(() => {
		const chain: Record<string, unknown> = {
			// biome-ignore lint/suspicious/noThenProperty: drizzle query builders are awaitable
			then: (resolve: (v: unknown) => void) => resolve(queue.shift() ?? []),
		};
		for (const m of ['from', 'where', 'innerJoin', 'leftJoin']) {
			chain[m] = () => chain;
		}
		return chain;
	});
	return { queue, select };
});
vi.mock('./drizzle.ts', () => ({ db: mocks }));
vi.mock('./household-today.ts', () => ({
	householdClock: async () => ({ today: '2026-10-06', timeZone: 'UTC' }),
}));
vi.mock('./member-stats.ts', () => ({
	memberWeekPoints: async () => 0,
	memberPointsBalance: async () => 0,
}));
vi.mock('@chore/db/household-streaks', () => ({
	householdStreaks: async () => ({ members: {}, today: '2026-10-06', due: [] }),
}));

const { loadToday } = await import('./today.ts');

const leo = { id: 'leo', householdId: 'h1', displayName: 'Leo' };
const chore = (id: string, over: Record<string, unknown> = {}) => ({
	id,
	householdId: 'h1',
	title: id,
	type: 'personal',
	points: 10,
	frequency: 'daily',
	dueTime: null,
	dueLabel: null,
	dueWeekday: null,
	assignedMemberId: 'leo',
	...over,
});
const instance = (choreId: string, over: Record<string, unknown> = {}) => ({
	id: `i-${choreId}`,
	choreId,
	periodStart: '2026-10-06',
	assignedMemberId: null,
	completionId: null,
	doneById: null,
	completerId: null,
	...over,
});

/** Queues one day: the chores, then the loop/instance rows that go with them. */
function queueDay(opts: {
	chores: unknown[];
	rotations?: unknown[];
	loopMembers?: unknown[];
	skips?: unknown[];
	instances?: unknown[];
}) {
	mocks.queue.push(
		opts.chores,
		[
			{ id: 'leo', name: 'Leo' },
			{ id: 'mia', name: 'Mia' },
			{ id: 'dad', name: 'Dad' },
		],
		opts.rotations ?? [],
		opts.loopMembers ?? [],
		[],
		opts.skips ?? [],
		opts.instances ?? [],
		[],
	);
}

beforeEach(() => {
	mocks.queue.length = 0;
});

describe('loadToday Help out (SB-75)', () => {
	it("lists other members' open chores and not the viewer's own", async () => {
		queueDay({
			chores: [
				chore('mine'),
				chore('mias', { assignedMemberId: 'mia' }),
				chore('nobodys', { assignedMemberId: null }),
			],
		});
		const today = await loadToday(leo);
		expect(today.personal.map((p) => p.choreId)).toEqual(['mine']);
		expect(today.helpOut.map((h) => [h.choreId, h.ownerName])).toEqual([
			['mias', 'Mia'],
		]);
	});

	it('leaves out done and skipped chores', async () => {
		queueDay({
			chores: [
				chore('done', { assignedMemberId: 'mia' }),
				chore('skipped', { assignedMemberId: 'mia' }),
				chore('open', { assignedMemberId: 'mia' }),
			],
			skips: [{ choreId: 'skipped', periodStart: '2026-10-06' }],
			instances: [instance('done', { completionId: 'c1', completerId: 'mia' })],
		});
		const today = await loadToday(leo);
		expect(today.helpOut.map((h) => h.choreId)).toEqual(['open']);
	});

	it('leaves out weekly chores that are not due until a later day', async () => {
		// 2026-10-06 is a Tuesday: due Friday is later this week, due Monday is overdue.
		queueDay({
			chores: [
				chore('later', {
					assignedMemberId: 'mia',
					frequency: 'weekly',
					dueWeekday: 5,
				}),
				chore('overdue', {
					assignedMemberId: 'mia',
					frequency: 'weekly',
					dueWeekday: 1,
				}),
			],
		});
		const today = await loadToday(leo);
		expect(today.helpOut.map((h) => [h.choreId, h.overdue])).toEqual([
			['overdue', true],
		]);
	});

	it('offers the turn of a rotation the viewer is not in, not one they are in', async () => {
		const rotation = (choreId: string) => ({
			choreId,
			householdId: 'h1',
			currentMemberId: 'dad',
			lastCompletedMemberId: null,
		});
		const loop = (choreId: string, memberId: string, position: number) => ({
			choreId,
			memberId,
			position,
			eligible: true,
		});
		queueDay({
			chores: [
				chore('gutters', { type: 'rotation', assignedMemberId: null }),
				chore('dishes', { type: 'rotation', assignedMemberId: null }),
			],
			rotations: [rotation('gutters'), rotation('dishes')],
			loopMembers: [
				loop('gutters', 'dad', 1),
				loop('dishes', 'dad', 1),
				loop('dishes', 'leo', 2),
			],
		});
		const today = await loadToday(leo);
		expect(today.rotations.map((r) => r.choreId)).toEqual(['dishes']);
		expect(today.helpOut.map((h) => [h.choreId, h.ownerName])).toEqual([
			['gutters', 'Dad'],
		]);
	});

	it("names the doer on the viewer's own chore a sibling did", async () => {
		queueDay({
			chores: [chore('mine')],
			instances: [
				instance('mine', {
					completionId: 'c1',
					doneById: 'mia',
					completerId: 'mia',
				}),
			],
		});
		const today = await loadToday(leo);
		expect(today.personal[0]?.subtitle).toBe('Done by Mia');
	});
});
