import { describe, expect, it } from 'vitest';
import {
	archivedChores,
	duplicateLinks,
	groupByIndividual,
	groupByRotation,
	loopTakers,
	parseGrouping,
	stageLabel,
	unassigned,
} from './chores-list.ts';
import {
	activeChores,
	allChores,
	bedroom,
	dishwasher,
	listMembers,
	mistake,
	oldChore,
	orphan,
	toilet,
} from './components/chores/choresListFixtures.ts';

describe('parseGrouping', () => {
	it('defaults to rotation for anything unknown', () => {
		expect(parseGrouping('individual')).toBe('individual');
		expect(parseGrouping('rotation')).toBe('rotation');
		expect(parseGrouping(undefined)).toBe('rotation');
		expect(parseGrouping('nonsense')).toBe('rotation');
	});
});

describe('stageLabel', () => {
	it('pluralises', () => {
		expect(stageLabel(0)).toBe('No stages');
		expect(stageLabel(1)).toBe('1 stage');
		expect(stageLabel(3)).toBe('3 stages');
	});
});

describe('loopTakers', () => {
	it('lists eligible members in turn order', () => {
		expect(loopTakers(toilet)).toEqual(['leo', 'mia']);
		expect(loopTakers({ ...toilet, loop: [...toilet.loop].reverse() })).toEqual(
			['leo', 'mia'],
		);
	});
});

describe('groupByRotation', () => {
	it('splits rotations from personal chores and drops archived ones', () => {
		const { rotations, personal } = groupByRotation(allChores);
		expect(rotations.map((c) => c.id)).toEqual(['toilet', 'dishwasher']);
		expect(personal.map((c) => c.id)).toEqual(['bedroom', 'bag', 'bins']);
	});

	it('lists every active chore exactly once', () => {
		const { rotations, personal } = groupByRotation(allChores);
		expect([...rotations, ...personal]).toHaveLength(activeChores.length);
	});
});

describe('groupByIndividual', () => {
	const groups = groupByIndividual(allChores, listMembers);
	const of = (id: string) => groups.find((g) => g.member.id === id);

	it('puts kids first, then parents who have chores', () => {
		expect(groups.map((g) => g.member.name)).toEqual(['Leo', 'Mia', 'Mom']);
	});

	it('leaves out a parent with no chores but keeps a kid with none', () => {
		expect(of('dad')).toBeUndefined();
		const onlyMia = groupByIndividual([bedroom], listMembers);
		expect(onlyMia.map((g) => g.member.id)).toEqual(['leo', 'mia']);
		expect(onlyMia[0]?.entries).toEqual([]);
	});

	it('lists a rotation under each member who takes turns, marking the turn', () => {
		const entry = (member: string, chore: string) =>
			of(member)?.entries.find((e) => e.chore.id === chore);
		expect(entry('leo', 'toilet')).toMatchObject({
			inRotation: true,
			theirTurn: true,
		});
		expect(entry('mia', 'toilet')).toMatchObject({
			inRotation: true,
			theirTurn: false,
		});
		expect(entry('mom', 'dishwasher')).toMatchObject({ inRotation: true });
	});

	it('skips members excluded from a loop', () => {
		// Dad is in the toilet loop but excluded, so it isn't his chore.
		expect(of('dad')).toBeUndefined();
	});

	it('lists personal chores only under their assignee', () => {
		expect(of('mia')?.entries.map((e) => e.chore.id)).toEqual([
			'toilet',
			'dishwasher',
			'bedroom',
		]);
		expect(of('mia')?.entries.at(-1)).toMatchObject({ inRotation: false });
		expect(of('leo')?.entries.map((e) => e.chore.id)).not.toContain('bedroom');
	});

	it('never lists archived chores', () => {
		const ids = groups.flatMap((g) => g.entries.map((e) => e.chore.id));
		expect(ids).not.toContain(oldChore.id);
		expect(ids).not.toContain(mistake.id);
	});
});

describe('unassigned', () => {
	it('finds personal chores whose assignee is gone', () => {
		expect(unassigned([...activeChores, orphan], listMembers)).toEqual([
			orphan,
		]);
		expect(
			unassigned([{ ...bedroom, assignedMemberId: 'removed' }], listMembers),
		).toHaveLength(1);
	});
});

describe('archivedChores', () => {
	it('returns only archived chores', () => {
		expect(archivedChores(allChores).map((c) => c.id)).toEqual([
			'old',
			'mistake',
		]);
	});
});

describe('duplicateLinks', () => {
	it('offers the same kind and the other kind', () => {
		expect(duplicateLinks(dishwasher)).toEqual([
			{ label: 'Duplicate', href: '/chores/new?from=dishwasher&kind=rotation' },
			{
				label: 'Duplicate as personal chore',
				href: '/chores/new?from=dishwasher&kind=personal',
			},
		]);
		expect(duplicateLinks(bedroom).map((l) => l.href)).toEqual([
			'/chores/new?from=bedroom&kind=personal',
			'/chores/new?from=bedroom&kind=rotation',
		]);
	});
});
