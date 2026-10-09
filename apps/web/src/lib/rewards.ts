import type { ClaimDenial } from '@chore/db/rewards';

// What the reward form (SB-27) edits, as plain data shared by the form, the
// remote functions and the tests. No server imports: this is bundled into the
// client, and the same validation runs again on the server.

export const REWARD_KINDS = ['personal', 'family_milestone'] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_COST_POINTS = 100_000;

/** The reward as the parent is filling it in. */
export interface RewardDraft {
	title: string;
	description: string;
	/** Kept as typed so an empty field isn't coerced to 0. */
	costPoints: string;
	kind: RewardKind;
	repeatable: boolean;
}

export const emptyRewardDraft = (): RewardDraft => ({
	title: '',
	description: '',
	costPoints: '',
	kind: 'personal',
	repeatable: false,
});

export interface DraftErrors {
	title?: string;
	description?: string;
	costPoints?: string;
}

export const hasErrors = (errors: DraftErrors) =>
	Boolean(errors.title || errors.description || errors.costPoints);

const parseCost = (value: string) =>
	/^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;

/** Whether the draft can be saved, worded for the form. */
export function validateRewardDraft(draft: RewardDraft): DraftErrors {
	const errors: DraftErrors = {};

	const title = draft.title.trim();
	if (!title) errors.title = 'Give the reward a title.';
	else if (title.length > MAX_TITLE_LENGTH)
		errors.title = `Keep the title under ${MAX_TITLE_LENGTH} characters.`;

	if (draft.description.length > MAX_DESCRIPTION_LENGTH)
		errors.description = `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`;

	const cost = parseCost(draft.costPoints);
	if (!Number.isInteger(cost) || cost < 1 || cost > MAX_COST_POINTS)
		errors.costPoints = `Enter a whole number of points from 1 to ${MAX_COST_POINTS.toLocaleString('en-US')}.`;

	return errors;
}

/** What the server accepts to create or update a reward. Trimmed, with an empty description as null. */
export interface RewardInput {
	title: string;
	description: string | null;
	costPoints: number;
	kind: RewardKind;
	repeatable: boolean;
}

export function toRewardInput(draft: RewardDraft): RewardInput {
	return {
		title: draft.title.trim(),
		description: draft.description.trim() || null,
		costPoints: parseCost(draft.costPoints),
		kind: draft.kind,
		// Family milestones are never repeatable.
		repeatable: draft.kind === 'personal' && draft.repeatable,
	};
}

export const draftOf = (reward: RewardInput): RewardDraft => ({
	title: reward.title,
	description: reward.description ?? '',
	costPoints: String(reward.costPoints),
	kind: reward.kind,
	repeatable: reward.repeatable,
});

/** True for a canonical UUID string; anything else would make Postgres fail with a 500. */
export const isUuid = (value: unknown): value is string =>
	typeof value === 'string' &&
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * Checks a request the same way the form does, for the server. Remote
 * functions take unchecked input, so every field is type-checked first.
 * Returns the first problem, worded for the form, or null.
 */
export function rewardInputError(input: unknown): string | null {
	if (typeof input !== 'object' || input === null)
		return 'The reward is not valid.';
	const { title, description, costPoints, kind, repeatable } = input as Record<
		string,
		unknown
	>;
	if (typeof title !== 'string') return 'Give the reward a title.';
	if (description !== null && typeof description !== 'string')
		return 'The description is not valid.';
	if (typeof costPoints !== 'number' || !Number.isInteger(costPoints))
		return 'Enter a whole number of points.';
	if (kind !== 'personal' && kind !== 'family_milestone')
		return 'Choose Personal Reward or Family Milestone.';
	if (typeof repeatable !== 'boolean')
		return 'The repeatable setting is not valid.';
	if (kind === 'family_milestone' && repeatable)
		return 'A family milestone cannot be repeatable.';
	const errors = validateRewardDraft({
		title,
		description: description ?? '',
		costPoints: String(costPoints),
		kind,
		repeatable,
	});
	return errors.title ?? errors.description ?? errors.costPoints ?? null;
}

/** The cost line: personal rewards spend points, milestones are a weekly household target. */
export const costLabel = (reward: Pick<RewardInput, 'kind' | 'costPoints'>) =>
	reward.kind === 'family_milestone'
		? `${reward.costPoints} household points in a week`
		: `${reward.costPoints} Points`;

/** The progress line under a family milestone: "2 more loops, 40 points to go". */
export function milestoneRemaining(
	remaining: number,
	loopsCompleted: number,
): string {
	if (remaining <= 0) return 'Unlocked this week';
	return `${remaining} more points to unlock (${loopsCompleted} ${loopsCompleted === 1 ? 'loop' : 'loops'} done this week)`;
}

export function claimDenialMessage(denial: ClaimDenial): string {
	switch (denial) {
		case 'not_found':
			return 'That reward was not found.';
		case 'not_claimable':
			return 'Family milestones unlock from the household total; they are not claimed.';
		case 'already_claimed':
			return 'You already claimed this reward.';
		case 'insufficient_points':
			return 'You do not have enough points for this reward yet.';
	}
}
