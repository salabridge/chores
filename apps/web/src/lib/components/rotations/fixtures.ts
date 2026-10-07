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
