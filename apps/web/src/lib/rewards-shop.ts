import type { MilestoneProgress, RewardStatus } from '@chore/db/rewards';

// Shapes what the Rewards Shop (SB-43) shows from the rewards (SB-27) and
// streak (SB-28) data. Pure, with no server imports, so the load and the tests
// share it and the screen's wording lives in one place.

/** One reward as `loadRewardShop()` returns it. */
export interface ShopReward {
	id: string;
	title: string;
	description: string | null;
	costPoints: number;
	kind: 'personal' | 'family_milestone';
	repeatable: boolean;
	status: RewardStatus;
}

export interface ShopData {
	balance: number;
	week: { points: number; loopsCompleted: number };
	rewards: ShopReward[];
	milestones: MilestoneProgress[];
}

/** A chore the member could do next to keep the streak going. */
export interface SuggestedChore {
	id: string;
	title: string;
}

export interface RewardItem {
	id: string;
	title: string;
	description: string | null;
	cost: number;
	status: 'claimable' | 'claimed' | 'locked';
	/** Where Claim goes: the confirmation step (works without JavaScript). */
	claimHref: string;
}

export interface MilestoneItem {
	id: string;
	title: string;
	description: string | null;
	current: number;
	target: number;
	percent: number;
	reached: boolean;
	nextUp: boolean;
	note: string;
}

export interface RewardsShopView {
	balance: number;
	household: {
		loops: number;
		points: number;
		/** One line under the tiles, e.g. "2 more loops unlock the next family reward." */
		summary: string;
	};
	momentum: {
		days: number;
		goal: number;
		loopsLeft: number;
		percent: number;
		message: string;
		chores: (SuggestedChore & { href: string })[];
	};
	earned: RewardItem[];
	saving: RewardItem[];
	milestones: MilestoneItem[];
}

/** Streak lengths worth aiming for, in order. */
const STREAK_GOALS = [3, 4, 5, 7, 10, 14, 21, 30, 50, 75, 100];

/** The next streak length to aim for: the smallest goal above `days`. */
export function nextStreakGoal(days: number): number {
	const goal = STREAK_GOALS.find((g) => g > days);
	return goal ?? Math.floor(days / 50 + 1) * 50;
}

/** The most chore chips shown on the momentum card. */
export const MAX_SUGGESTED_CHORES = 4;

const plural = (n: number, one: string, many = `${one}s`) =>
	`${n} ${n === 1 ? one : many}`;

/**
 * How many loops at this week's average points per loop it takes to earn
 * `points` more, or null when the week has no loops to average over yet.
 */
export function loopsToEarn(
	points: number,
	week: ShopData['week'],
): number | null {
	if (points <= 0 || week.loopsCompleted <= 0 || week.points <= 0) return null;
	const average = week.points / week.loopsCompleted;
	return Math.max(1, Math.ceil(points / average));
}

/** "10 more points or 1 shared loop away." under a milestone. */
export function milestoneNote(
	milestone: Pick<MilestoneProgress, 'reached' | 'remaining'>,
	week: ShopData['week'],
): string {
	if (milestone.reached) return 'Unlocked this week.';
	const loops = loopsToEarn(milestone.remaining, week);
	const points = plural(milestone.remaining, 'more point');
	return loops === null
		? `${points} to go.`
		: `${points} or ${plural(loops, 'shared loop')} away.`;
}

function householdSummary(
	milestones: MilestoneProgress[],
	week: ShopData['week'],
): string {
	if (milestones.length === 0) return 'No family rewards are set up yet.';
	const next = milestones.find((m) => m.nextUp);
	if (!next) return 'Every family reward is unlocked this week.';
	const loops = loopsToEarn(next.remaining, week);
	return loops === null
		? `${plural(next.remaining, 'more point')} unlock the next family reward.`
		: `${plural(loops, 'more loop')} unlock the next family reward.`;
}

function momentumMessage(
	days: number,
	goal: number,
	loopsLeft: number,
): string {
	if (days === 0) return 'Finish a loop today to start a streak.';
	return loopsLeft === 1
		? `You're close to a ${goal}-day personal streak and one more easy loop is enough to get there.`
		: `${plural(loopsLeft, 'more loop')} to reach a ${goal}-day personal streak.`;
}

const rewardItem = (r: ShopReward): RewardItem => ({
	id: r.id,
	title: r.title,
	description: r.description,
	cost: r.costPoints,
	status:
		r.status === 'earned'
			? 'claimable'
			: r.status === 'claimed'
				? 'claimed'
				: 'locked',
	claimHref: `/rewards?confirm=${r.id}`,
});

/** Everything the screen renders, from the loaded shop, the streak and the suggested chores. */
export function shapeRewardsShop(input: {
	shop: ShopData;
	streakDays: number;
	suggested: readonly SuggestedChore[];
}): RewardsShopView {
	const { shop, streakDays } = input;
	const goal = nextStreakGoal(streakDays);
	const loopsLeft = goal - streakDays;
	const personal = shop.rewards.filter((r) => r.kind === 'personal');
	const progress = new Map(shop.milestones.map((m) => [m.id, m]));

	return {
		balance: shop.balance,
		household: {
			loops: shop.week.loopsCompleted,
			points: shop.week.points,
			summary: householdSummary(shop.milestones, shop.week),
		},
		momentum: {
			days: streakDays,
			goal,
			loopsLeft,
			percent: Math.round((streakDays / goal) * 100),
			message: momentumMessage(streakDays, goal, loopsLeft),
			chores: input.suggested.slice(0, MAX_SUGGESTED_CHORES).map((c) => ({
				...c,
				href: `/chores/${c.id}`,
			})),
		},
		// Claimable first, then what's already claimed.
		earned: personal
			.filter((r) => r.status === 'earned' || r.status === 'claimed')
			.map(rewardItem)
			.toSorted(
				(a, b) =>
					Number(a.status === 'claimed') - Number(b.status === 'claimed'),
			),
		saving: personal.filter((r) => r.status === 'locked').map(rewardItem),
		milestones: shop.rewards.flatMap((r) => {
			const p = progress.get(r.id);
			if (r.kind !== 'family_milestone' || !p) return [];
			return [
				{
					id: r.id,
					title: r.title,
					description: r.description,
					current: p.current,
					target: p.target,
					percent: p.percent,
					reached: p.reached,
					nextUp: p.nextUp,
					note: milestoneNote(p, shop.week),
				},
			];
		}),
	};
}
