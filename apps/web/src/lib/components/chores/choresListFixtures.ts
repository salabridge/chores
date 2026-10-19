import type { ChoreListItem, ChoreListMember } from '#lib/chores-list.js';

// Fixed data for specs and stories (stories are Chromatic snapshots, so no
// dates or randomness).

export const listMembers: ChoreListMember[] = [
	{ id: 'mom', name: 'Mom', role: 'owner' },
	{ id: 'dad', name: 'Dad', role: 'parent' },
	{ id: 'mia', name: 'Mia', role: 'kid' },
	{ id: 'leo', name: 'Leo', role: 'kid' },
];

const base: ChoreListItem = {
	id: '',
	title: '',
	type: 'personal',
	frequency: 'daily',
	dueWeekday: null,
	points: 10,
	stageCount: 0,
	assignedMemberId: null,
	currentMemberId: null,
	loop: [],
	archived: false,
	completed: false,
};

export const toilet: ChoreListItem = {
	...base,
	id: 'toilet',
	title: 'Shared Bathroom Toilet',
	type: 'rotation',
	frequency: 'weekly',
	dueWeekday: 4,
	points: 20,
	stageCount: 3,
	currentMemberId: 'leo',
	loop: [
		{ memberId: 'leo', position: 1, eligible: true },
		{ memberId: 'mia', position: 2, eligible: true },
		{ memberId: 'dad', position: 3, eligible: false },
	],
};

export const dishwasher: ChoreListItem = {
	...base,
	id: 'dishwasher',
	title: 'Run Dishwasher',
	type: 'rotation',
	points: 5,
	currentMemberId: 'mia',
	loop: [
		{ memberId: 'leo', position: 1, eligible: true },
		{ memberId: 'mia', position: 2, eligible: true },
		{ memberId: 'mom', position: 3, eligible: true },
	],
};

export const bedroom: ChoreListItem = {
	...base,
	id: 'bedroom',
	title: 'Tidy Bedroom',
	frequency: 'weekends',
	points: 15,
	stageCount: 2,
	assignedMemberId: 'mia',
};

export const schoolBag: ChoreListItem = {
	...base,
	id: 'bag',
	title: 'Pack School Bag',
	assignedMemberId: 'leo',
};

export const bins: ChoreListItem = {
	...base,
	id: 'bins',
	title: 'Take Out Bins',
	frequency: 'weekly',
	assignedMemberId: 'mom',
};

/** A personal chore whose assignee was removed. */
export const orphan: ChoreListItem = {
	...base,
	id: 'orphan',
	title: 'Water Plants',
};

/** Archived and completed before: can be restored, not deleted. */
export const oldChore: ChoreListItem = {
	...base,
	id: 'old',
	title: 'Feed Goldfish',
	assignedMemberId: 'leo',
	archived: true,
	completed: true,
};

/** Archived and never completed: can be restored or deleted. */
export const mistake: ChoreListItem = {
	...base,
	id: 'mistake',
	title: 'Duplicate Test Chore',
	assignedMemberId: 'mia',
	archived: true,
};

export const activeChores = [toilet, dishwasher, bedroom, schoolBag, bins];
export const allChores = [...activeChores, oldChore, mistake];
