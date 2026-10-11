import type { DetailStage } from './rotation-detail.ts';

// What the personal chore screen (SB-40) shows, as plain data that the server
// load, the component, and the tests share. No server imports here: this file
// is bundled into the client.

export interface PersonalDetail {
	choreId: string;
	title: string;
	/** The parent note. */
	description: string | null;
	points: number;
	assigneeName: string | null;
	/** The viewing member is who the chore is assigned to. */
	isAssignee: boolean;
	/** This period's chore is already done. */
	completedThisPeriod: boolean;
	/** The chore doesn't occur today (a weekends chore on a weekday). */
	availableToday: boolean;
	/** The assignee is looking at a chore that is open now. */
	canComplete: boolean;
	/** Empty for a single-step chore. */
	stages: DetailStage[];
}

/**
 * Who this period's chore belongs to. An instance already worked on keeps its
 * assignee; an untouched one follows the chore's current assignee, so a parent
 * reassigning a chore mid-day moves it to the new person.
 */
export function effectiveAssignee(facts: {
	choreAssigneeId: string | null;
	instanceAssigneeId: string | null;
	/** The instance has a completion or stage progress. */
	touched: boolean;
}): string | null {
	if (facts.instanceAssigneeId && facts.touched)
		return facts.instanceAssigneeId;
	return facts.choreAssigneeId ?? facts.instanceAssigneeId;
}

type StageFacts = Pick<PersonalDetail, 'stages'>;

/** 1-based number of the stage being worked on, or null (no stages, or all done). */
export function activeStageNumber({ stages }: StageFacts): number | null {
	const index = stages.findIndex((s) => s.state === 'current');
	return index === -1 ? null : index + 1;
}

export function doneStageCount({ stages }: StageFacts): number {
	return stages.filter((s) => s.state === 'completed').length;
}

/** "Stage 2: Dust surfaces", as the checklist shows it. */
export const stageLabel = (index: number, title: string) =>
	`Stage ${index + 1}: ${title}`;

/** The progress card heading. */
export const progressTitle = (title: string) => `${title} Progress`;

/** The progress card's second line. */
export function progressDescription(detail: StageFacts): string {
	const total = detail.stages.length;
	const active = activeStageNumber(detail);
	if (active === null) return `All ${total} stages are done`;
	return `Stage ${active} of ${total} is active right now`;
}

/** The line under the title: the parent's note, or a generated one. */
export function introText(
	detail: Pick<PersonalDetail, 'description' | 'points' | 'stages'>,
): string {
	const note = detail.description?.trim();
	if (note) return note;
	return detail.stages.length > 0
		? `Finish all ${detail.stages.length} stages to earn ${detail.points} points.`
		: `Finish this chore to earn ${detail.points} points.`;
}

/** The sticky button: "Complete Stage N", then "Complete Chore", or "Mark Done" with no stages. */
export function ctaLabel(detail: StageFacts): string {
	if (detail.stages.length === 0) return 'Mark Done';
	const active = activeStageNumber(detail);
	if (active === null || active === detail.stages.length)
		return 'Complete Chore';
	return `Complete Stage ${active}`;
}

/** The "What happens next" callout. */
export function nextText(
	detail: Pick<PersonalDetail, 'stages' | 'points'>,
): string {
	const total = detail.stages.length;
	const active = activeStageNumber(detail);
	if (total === 0) {
		return `Tap Mark Done when you finish to claim the ${detail.points}-point reward.`;
	}
	if (active === null || active === total) {
		return `Finish Stage ${total} to complete the chore and claim the full ${detail.points}-point reward.`;
	}
	return `Finish Stage ${active} to unlock Stage ${active + 1}. Complete all ${total} stages to claim the full ${detail.points}-point reward.`;
}

/** Left half of the footer row ("Reward after all 3 stages"). */
export const rewardLabel = (detail: StageFacts) =>
	detail.stages.length > 0
		? `Reward after all ${detail.stages.length} stages`
		: 'Reward for finishing';

/** The whole footer line: "Reward after all 3 stages · 15 pts". */
export const rewardSummary = (
	detail: Pick<PersonalDetail, 'stages' | 'points'>,
) => `${rewardLabel(detail)} · ${detail.points} pts`;

/** Shown in place of the button when it can't be pressed. */
export function waitingText(
	detail: Pick<
		PersonalDetail,
		'assigneeName' | 'completedThisPeriod' | 'availableToday' | 'isAssignee'
	>,
): string {
	if (detail.completedThisPeriod) {
		return detail.isAssignee
			? 'Done for now. Nice work!'
			: `${detail.assigneeName ?? 'They'} finished this chore for now.`;
	}
	if (!detail.availableToday) return "This chore isn't due today.";
	if (!detail.assigneeName) return 'Nobody is assigned to this chore yet.';
	return `Only ${detail.assigneeName} can complete this chore. You can follow along here.`;
}
