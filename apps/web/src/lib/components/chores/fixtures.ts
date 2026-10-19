import type { CompletionSummary } from '#lib/chore-completion.js';
import type { MemberOption } from '#lib/chore-creator.js';
import type { PersonalDetail } from '#lib/personal-detail.js';

// Fixed data for specs and stories (stories are Chromatic snapshots).

export const householdMembers: MemberOption[] = [
	{ id: 'mom', name: 'Mom' },
	{ id: 'dad', name: 'Dad' },
	{ id: 'leo', name: 'Leo' },
	{ id: 'mia', name: 'Mia' },
];

// Personal chore detail screen (SB-40)

export const roomDetail: PersonalDetail = {
	choreId: 'chore-room',
	title: 'Clean Your Room',
	description:
		'Break your room clean into three quick stages. Finish them all to earn your loop stars!',
	points: 15,
	schedule: 'Daily',
	assigneeId: 'leo',
	assigneeName: 'Leo',
	isAssignee: true,
	completedThisPeriod: false,
	doneBy: null,
	availableToday: true,
	canComplete: true,
	canCompleteForAssignee: false,
	stages: [
		{
			id: 's1',
			title: 'Put away toys & clothes',
			hint: null,
			state: 'completed',
		},
		{
			id: 's2',
			title: 'Dust surfaces & wipe desk',
			hint: null,
			state: 'current',
		},
		{ id: 's3', title: 'Vacuum the carpet', hint: null, state: 'locked' },
	],
};

/** The last stage is active, so the button says "Complete Chore". */
export const roomLastStage: PersonalDetail = {
	...roomDetail,
	stages: roomDetail.stages.map((s, i) => ({
		...s,
		state: i < 2 ? 'completed' : 'current',
	})),
};

/** A chore with no stages: one "Mark Done" button. */
export const singleStepDetail: PersonalDetail = {
	...roomDetail,
	choreId: 'chore-trash',
	title: 'Take Out the Trash',
	description: null,
	points: 10,
	stages: [],
};

/** Someone else's chore: the screen reads as view only. */
export const roomReadOnly: PersonalDetail = {
	...roomDetail,
	isAssignee: false,
	canComplete: false,
	canCompleteForAssignee: true,
	assigneeId: 'mia',
	assigneeName: 'Mia',
};

/** Done for this period. */
export const roomDone: PersonalDetail = {
	...roomDetail,
	completedThisPeriod: true,
	canComplete: false,
	stages: roomDetail.stages.map((s) => ({ ...s, state: 'completed' as const })),
};

// Completion celebration screen (SB-42)

const goal = (earned: number, target: number) => ({
	earned,
	goal: target,
	remaining: Math.max(0, target - earned),
	percent:
		target <= 0 ? 100 : Math.min(100, Math.floor((earned / target) * 100)),
	reached: earned >= target,
});

/** A shared rotation chore: the turn moved to Mia. */
export const toiletCompletion: CompletionSummary = {
	choreId: 'chore-toilet',
	title: 'Clean Bathroom Toilet',
	memberName: 'Leo',
	doneFor: null,
	points: 20,
	totalPoints: 160,
	rotation: { nextName: 'Mia', nextIsYou: false },
	goal: goal(160, 200),
};

/** A personal chore: no rotation tags. */
export const roomCompletion: CompletionSummary = {
	...toiletCompletion,
	choreId: 'chore-room',
	title: 'Clean Your Room',
	points: 15,
	totalPoints: 135,
	rotation: null,
	goal: goal(135, 200),
};

/** The weekly goal is met. */
export const goalReachedCompletion: CompletionSummary = {
	...roomCompletion,
	totalPoints: 215,
	goal: goal(215, 200),
};
