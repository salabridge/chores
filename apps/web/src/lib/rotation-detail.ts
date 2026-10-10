import { joinNames, type RotationScope } from './rotation-loops.ts';

// What the shared rotation chore screen (SB-41) shows, as plain data that the
// server load, the component, and the tests share. No server imports here:
// this file is bundled into the client.

export interface DetailMember {
	memberId: string;
	name: string;
	position: number;
	eligible: boolean;
	exclusionReason: string | null;
}

export interface DetailStage {
	id: string;
	title: string;
	hint: string | null;
	state: 'completed' | 'current' | 'locked';
}

export interface RotationDetail {
	choreId: string;
	title: string;
	description: string | null;
	points: number;
	scope: RotationScope;
	scopeLabel: string | null;
	/** Every member in turn order, excluded ones included. */
	members: DetailMember[];
	doneLast: DetailMember | null;
	activeTurn: DetailMember | null;
	nextUp: DetailMember | null;
	/** It is the viewing member's turn and the chore can be done now. */
	canComplete: boolean;
	/** The viewing member holds the turn (even if it can't be done right now). */
	isMyTurn: boolean;
	/** This period's turn is already done; the next one waits for the next period. */
	completedThisPeriod: boolean;
	/** The chore doesn't occur today (a weekends chore on a weekday). */
	availableToday: boolean;
	/** Empty when the rotation has no stages. */
	stages: DetailStage[];
}

/** Generic, since chores have no label of their own for the button. */
export const COMPLETE_TURN_LABEL = 'Mark my turn done';

/** The heading over the Done Last / Active Turn / Next Up visual. */
export const loopHeading = (detail: Pick<RotationDetail, 'scopeLabel'>) =>
	`The ${detail.scopeLabel?.trim() || 'Household'} Rotation Loop`;

const eligible = (members: readonly DetailMember[]) =>
	members.filter((m) => m.eligible);

/** The line under the title: the chore's own description, or a generated one. */
export function introText(
	detail: Pick<RotationDetail, 'description' | 'members'>,
): string {
	const note = detail.description?.trim();
	if (note) return note;
	const names = eligible(detail.members).map((m) => m.name);
	const who =
		names.length > 0
			? `${joinNames(names)} share it in order`
			: 'Members share it in order';
	return `This is a household rotation chore. ${who}, and the loop advances to the next eligible member as soon as the current turn is completed.`;
}

/** Eligibility Rules callout: who's in the loop, who's out, and why. */
export function eligibilityText(
	detail: Pick<RotationDetail, 'members' | 'scopeLabel'>,
): string {
	const included = eligible(detail.members).map((m) => m.name);
	const excluded = detail.members.filter((m) => !m.eligible);
	const label = detail.scopeLabel?.trim();
	const parts = [
		included.length === 0
			? 'Nobody is eligible for this loop right now.'
			: `Only ${joinNames(included)} ${included.length === 1 ? 'is' : 'are'} included in this loop${label ? ` (${label})` : ''}.`,
	];
	for (const m of excluded) {
		const reason = m.exclusionReason?.trim();
		parts.push(`${m.name} is excluded${reason ? `: ${reason}` : '.'}`);
	}
	return parts.join(' ');
}

/** When the rotation advances callout. */
export function advanceText(
	detail: Pick<RotationDetail, 'activeTurn' | 'nextUp'>,
): string {
	const { activeTurn, nextUp } = detail;
	if (!activeTurn) {
		return 'The loop advances as soon as someone completes their turn, once a member is eligible.';
	}
	const lead = `The loop advances immediately after ${activeTurn.name} completes this turn.`;
	if (!nextUp || nextUp.memberId === activeTurn.memberId) {
		return `${lead} ${activeTurn.name} is the only eligible member, so the turn comes straight back.`;
	}
	return `${lead} ${nextUp.name} will become the next active member automatically.`;
}

/** How to complete this turn callout. */
export function howToText(
	detail: Pick<RotationDetail, 'points' | 'nextUp' | 'activeTurn' | 'stages'>,
): string {
	const handoff =
		detail.nextUp && detail.nextUp.memberId !== detail.activeTurn?.memberId
			? ` and pass the rotation to ${detail.nextUp.name}`
			: '';
	if (detail.stages.length > 0) {
		return `Check off each stage in order. The last stage claims your ${detail.points} points${handoff}.`;
	}
	return `Finish the chore, then tap the button below to claim your ${detail.points} points${handoff}.`;
}

/** What the sticky button says: the generic label, or the next stage's step. */
export function ctaLabel(detail: Pick<RotationDetail, 'stages'>): string {
	const { stages } = detail;
	if (stages.length === 0) return COMPLETE_TURN_LABEL;
	const index = stages.findIndex((s) => s.state === 'current');
	if (index === -1 || index === stages.length - 1) return 'Complete Chore';
	return `Finish stage ${index + 1} of ${stages.length}`;
}

/** Shown in place of the button when it can't be pressed. */
export function waitingText(
	detail: Pick<
		RotationDetail,
		'activeTurn' | 'completedThisPeriod' | 'availableToday' | 'isMyTurn'
	>,
): string {
	if (!detail.availableToday) return "This chore isn't due today.";
	if (detail.completedThisPeriod) {
		return detail.activeTurn
			? `Done for now. ${detail.activeTurn.name} has the next turn.`
			: 'Done for now.';
	}
	if (!detail.activeTurn) return 'Nobody is eligible to take this turn yet.';
	return `It's ${detail.activeTurn.name}'s turn.`;
}

/** Stage states for the checklist: done ones, the first open one, then locked. */
export function stageStates(
	stages: readonly { id: string; title: string; hint: string | null }[],
	doneIds: ReadonlySet<string>,
): DetailStage[] {
	let currentSeen = false;
	return stages.map((s) => {
		if (doneIds.has(s.id)) return { ...s, state: 'completed' as const };
		if (!currentSeen) {
			currentSeen = true;
			return { ...s, state: 'current' as const };
		}
		return { ...s, state: 'locked' as const };
	});
}
