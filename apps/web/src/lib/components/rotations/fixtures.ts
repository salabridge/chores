import type { RotationDetail } from '#lib/rotation-detail.js';
import type { LoopMember, RotationLoop } from '#lib/rotation-loops.js';

// Fixed data for specs and stories (stories are Chromatic snapshots, so no
// dates or randomness).

const included = (
	memberId: string,
	name: string,
	position: number,
): LoopMember => ({
	memberId,
	name,
	position,
	eligible: true,
	exclusionReason: null,
});

const excluded = (
	memberId: string,
	name: string,
	position: number,
	exclusionReason: string,
): LoopMember => ({
	memberId,
	name,
	position,
	eligible: false,
	exclusionReason,
});

export const toiletLoop: RotationLoop = {
	choreId: 'chore-toilet',
	title: 'Shared Bathroom Toilet',
	description: 'Kids-only shared chore for the bathroom rotation.',
	points: 20,
	scope: 'eligible_subset',
	scopeLabel: 'Kids only',
	currentMemberId: 'leo',
	members: [
		included('leo', 'Leo', 1),
		included('mia', 'Mia', 2),
		excluded(
			'mom',
			'Mom',
			3,
			'parents are not part of this kids-only rotation.',
		),
		excluded(
			'dad',
			'Dad',
			4,
			'parents are not part of this kids-only rotation.',
		),
	],
};

export const dishwasherLoop: RotationLoop = {
	choreId: 'chore-dishwasher',
	title: 'Run Dishwasher',
	description: 'Household rotation for older helpers after dinner.',
	points: 15,
	scope: 'whole_household',
	scopeLabel: null,
	currentMemberId: 'mom',
	members: [
		included('mom', 'Mom', 1),
		included('dad', 'Dad', 2),
		included('leo', 'Leo', 3),
		excluded('mia', 'Mia', 4, 'not yet eligible for hot-water handling.'),
	],
};

// Detail screen (SB-41)

const dm = (
	memberId: string,
	name: string,
	position: number,
	eligible = true,
	exclusionReason: string | null = null,
) => ({ memberId, name, position, eligible, exclusionReason });

const leo = dm('leo', 'Leo', 1);
const mia = dm('mia', 'Mia', 2);

export const toiletDetail: RotationDetail = {
	choreId: 'chore-toilet',
	title: 'Clean Bathroom Toilet',
	description: null,
	points: 20,
	scope: 'eligible_subset',
	scopeLabel: 'Kids Shared Bathroom',
	members: [
		leo,
		mia,
		dm('mom', 'Mom', 3, false, 'parents are not part of this kids-only loop.'),
		dm('dad', 'Dad', 4, false),
	],
	doneLast: mia,
	activeTurn: leo,
	nextUp: mia,
	isMyTurn: true,
	canComplete: true,
	completedThisPeriod: false,
	availableToday: true,
	stages: [],
};

/** Someone else's turn: no button, just whose turn it is. */
export const toiletWaiting: RotationDetail = {
	...toiletDetail,
	doneLast: leo,
	activeTurn: mia,
	nextUp: leo,
	isMyTurn: false,
	canComplete: false,
};

/** Done for this period; the turn already moved on. */
export const toiletDone: RotationDetail = {
	...toiletWaiting,
	completedThisPeriod: true,
};

/** A staged rotation (the mocks don't cover this; see the PR notes). */
export const dishwasherDetail: RotationDetail = {
	...toiletDetail,
	choreId: 'chore-dishwasher',
	title: 'Run Dishwasher',
	points: 15,
	stages: [
		{ id: 's1', title: 'Load the dishwasher', hint: null, state: 'completed' },
		{ id: 's2', title: 'Run the cycle', hint: null, state: 'current' },
		{ id: 's3', title: 'Unload and put away', hint: null, state: 'locked' },
	],
};
