// What the parent chores list (SB-62) shows, as plain data that the server
// load, the list components, and the tests all share, plus the two groupings.
// No server imports here: this file is bundled into the client.

export type ChoreListFrequency = 'daily' | 'weekly' | 'weekends';

export type ChoresGrouping = 'rotation' | 'individual';

/** Cookie that remembers the grouping on this device. */
export const GROUPING_COOKIE = 'chores-grouping';

export const parseGrouping = (value: unknown): ChoresGrouping =>
	value === 'individual' ? 'individual' : 'rotation';

export interface ChoreListMember {
	id: string;
	name: string;
	/** Kids sort before parents. */
	role: 'owner' | 'parent' | 'kid';
}

/** A member of a rotation chore's loop; excluded members don't take turns. */
export interface ChoreListLoopMember {
	memberId: string;
	position: number;
	eligible: boolean;
}

export interface ChoreListItem {
	id: string;
	title: string;
	type: 'personal' | 'rotation';
	frequency: ChoreListFrequency;
	points: number;
	stageCount: number;
	/** Personal chores only. */
	assignedMemberId: string | null;
	/** Rotation chores only: whose turn it is now. */
	currentMemberId: string | null;
	/** Rotation chores only, in turn order. */
	loop: ChoreListLoopMember[];
	archived: boolean;
	/** Whether anyone has ever completed it; a completed chore can't be deleted. */
	completed: boolean;
}

export const frequencyLabel: Record<ChoreListFrequency, string> = {
	daily: 'Daily',
	weekly: 'Weekly',
	weekends: 'Weekends',
};

export const stageLabel = (count: number) =>
	count === 0 ? 'No stages' : count === 1 ? '1 stage' : `${count} stages`;

const isParent = (m: ChoreListMember) => m.role !== 'kid';

const byName = (a: ChoreListMember, b: ChoreListMember) =>
	a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

/** The members who actually take turns, in turn order. */
export const loopTakers = (chore: ChoreListItem): string[] =>
	chore.loop
		.filter((m) => m.eligible)
		.sort((a, b) => a.position - b.position)
		.map((m) => m.memberId);

export interface RotationGroups {
	rotations: ChoreListItem[];
	personal: ChoreListItem[];
}

/** One section per rotation chore, then everything else as personal chores. */
export function groupByRotation(chores: ChoreListItem[]): RotationGroups {
	const active = chores.filter((c) => !c.archived);
	return {
		rotations: active.filter((c) => c.type === 'rotation'),
		personal: active.filter((c) => c.type !== 'rotation'),
	};
}

export interface IndividualEntry {
	chore: ChoreListItem;
	/** The chore is a rotation this person takes turns in. */
	inRotation: boolean;
	/** It's a rotation and it's this person's turn. */
	theirTurn: boolean;
}

export interface IndividualGroup {
	member: ChoreListMember;
	entries: IndividualEntry[];
}

/**
 * One section per member: every kid (even with no chores), then the parents
 * who have any. A rotation chore appears under each member who takes turns in
 * it; an excluded member isn't in the rotation, so it doesn't show for them.
 */
export function groupByIndividual(
	chores: ChoreListItem[],
	members: ChoreListMember[],
): IndividualGroup[] {
	const active = chores.filter((c) => !c.archived);
	const groups = [...members]
		.sort((a, b) => Number(isParent(a)) - Number(isParent(b)) || byName(a, b))
		.map((member): IndividualGroup => {
			const entries: IndividualEntry[] = [];
			for (const chore of active) {
				if (chore.type === 'rotation') {
					if (!loopTakers(chore).includes(member.id)) continue;
					entries.push({
						chore,
						inRotation: true,
						theirTurn: chore.currentMemberId === member.id,
					});
				} else if (chore.assignedMemberId === member.id) {
					entries.push({ chore, inRotation: false, theirTurn: false });
				}
			}
			return { member, entries };
		});
	return groups.filter((g) => g.entries.length > 0 || !isParent(g.member));
}

/** Chores with no assignee at all (their assignee was removed). */
export const unassigned = (
	chores: ChoreListItem[],
	members: ChoreListMember[],
): ChoreListItem[] => {
	const ids = new Set(members.map((m) => m.id));
	return chores.filter(
		(c) =>
			!c.archived &&
			c.type !== 'rotation' &&
			(!c.assignedMemberId || !ids.has(c.assignedMemberId)),
	);
};

export const archivedChores = (chores: ChoreListItem[]) =>
	chores.filter((c) => c.archived);

/** The "Duplicate as…" menu targets (SB-64 handles the receiving side). */
export function duplicateLinks(chore: ChoreListItem) {
	const other = chore.type === 'rotation' ? 'personal' : 'rotation';
	return [
		{
			label: 'Duplicate',
			href: `/chores/new?from=${chore.id}&kind=${chore.type}`,
		},
		{
			label: `Duplicate as ${other} chore`,
			href: `/chores/new?from=${chore.id}&kind=${other}`,
		},
	];
}
