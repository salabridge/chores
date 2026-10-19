// The chore completion celebration (SB-42). The completion id lives in the URL
// so the screen reads what was awarded from the server, and refreshing it never
// completes (or awards) anything again. Plain data and copy, shared by the
// server load, the component and the tests. No server imports here.

/** The celebration screen for one completion. */
export function completionHref(choreId: string, completionId: string): string {
	return `/chores/${encodeURIComponent(choreId)}/done?completion=${encodeURIComponent(completionId)}`;
}

export interface WeeklyGoal {
	/** Points earned from chores since the household's Monday. */
	earned: number;
	/** The member's weekly points goal. */
	goal: number;
	/** `goal - earned`, never below 0. */
	remaining: number;
	/** Whole percent of the goal reached, capped at 100. */
	percent: number;
	reached: boolean;
}

export interface CompletionSummary {
	choreId: string;
	title: string;
	/** Who earned the points: the assignee, or whoever did it for them (SB-74). */
	memberName: string;
	/**
	 * Whose chore it was, when the member did it for someone else (SB-74): the
	 * assignee or rotation turn-holder. Null when it was the member's own.
	 */
	doneFor: { memberId: string; name: string } | null;
	/** Points this completion awarded, as recorded on the completion row. */
	points: number;
	/**
	 * `pending` while a favour waits for the assignee's (or a parent's) OK
	 * (SB-79): `points` are what the member gets once it's approved, and
	 * aren't in `totalPoints` yet. A rotation hasn't moved on yet either.
	 */
	approvalStatus: 'approved' | 'pending';
	/** The member's balance now: the sum of their ledger rows. */
	totalPoints: number;
	/** Set for a shared rotation chore; null for a personal one (no tags). */
	rotation: {
		/** Who holds the turn now, or null when nobody is eligible. */
		nextName: string | null;
		/** The finisher is the only eligible member, so the turn comes back. */
		nextIsYou: boolean;
	} | null;
	goal: WeeklyGoal;
}

export const celebrationHeading = (memberName: string) =>
	`Nice work, ${memberName}!`;

/** The line under the heading. */
export function summaryLine(
	summary: Pick<CompletionSummary, 'title' | 'rotation'>,
): string {
	const done = `${summary.title} is complete`;
	const { rotation } = summary;
	if (!rotation) return `${done}.`;
	if (rotation.nextIsYou) {
		return `${done}, and you are the only member in the rotation, so the next turn is yours too.`;
	}
	if (rotation.nextName) {
		return `${done}, and the rotation has moved to ${rotation.nextName}.`;
	}
	return `${done}.`;
}

/** The tags under the title: none for a personal chore. */
export function summaryTags(
	summary: Pick<CompletionSummary, 'rotation'>,
): { tone: 'shared' | 'next'; label: string }[] {
	const { rotation } = summary;
	if (!rotation) return [];
	const tags: { tone: 'shared' | 'next'; label: string }[] = [
		{ tone: 'shared', label: 'Shared rotation' },
	];
	if (rotation.nextName) {
		tags.push({
			tone: 'next',
			label: `Next up: ${rotation.nextIsYou ? 'You' : rotation.nextName}`,
		});
	}
	return tags;
}

export const pointsAwardedText = (points: number) => `+${points} pts`;

export const totalText = (total: number) => `Your total is now ${total} pts.`;

export const goalReachedText = (goal: Pick<WeeklyGoal, 'earned' | 'goal'>) =>
	`${goal.earned} / ${goal.goal} Points reached`;

export function goalLeftText(goal: Pick<WeeklyGoal, 'remaining' | 'reached'>) {
	if (goal.reached) return 'Weekly goal reached. Great job!';
	return `${goal.remaining} ${goal.remaining === 1 ? 'point' : 'points'} left before the next reward unlock.`;
}

export interface ConfettiPiece {
	/** Final position inside the 140px square, in px from the top left. */
	x: number;
	y: number;
	/** Final rotation in degrees. */
	rotate: number;
	width: number;
	height: number;
	color: 'blue' | 'green' | 'amber' | 'white';
	/** Animation delay in ms, so the burst staggers. */
	delay: number;
	round?: boolean;
}

/**
 * Fixed pieces around the medallion, so the screen (and its Chromatic
 * snapshot) is the same every time. No randomness.
 */
export const confettiPieces: readonly ConfettiPiece[] = [
	{ x: 14, y: 22, rotate: 24, width: 14, height: 8, color: 'blue', delay: 0 },
	{
		x: 112,
		y: 14,
		rotate: 38,
		width: 10,
		height: 10,
		color: 'amber',
		delay: 60,
	},
	{
		x: 12,
		y: 96,
		rotate: 38,
		width: 8,
		height: 8,
		color: 'white',
		delay: 120,
		round: true,
	},
	{
		x: 110,
		y: 100,
		rotate: 14,
		width: 12,
		height: 6,
		color: 'green',
		delay: 180,
	},
	{ x: 66, y: 2, rotate: 8, width: 8, height: 12, color: 'white', delay: 90 },
	{
		x: 126,
		y: 58,
		rotate: 62,
		width: 8,
		height: 8,
		color: 'blue',
		delay: 150,
		round: true,
	},
	{ x: 0, y: 60, rotate: 30, width: 10, height: 6, color: 'amber', delay: 30 },
	{
		x: 64,
		y: 128,
		rotate: 50,
		width: 10,
		height: 6,
		color: 'blue',
		delay: 210,
	},
];
