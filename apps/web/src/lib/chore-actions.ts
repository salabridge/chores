// What the Overview's Skip and Remind may do to a chore (SB-29). Pure, so the
// rules are testable without a database; `server/chore-actions.ts` loads the
// facts and applies the result.

/** The facts about a chore today that decide what a parent action may do. */
export interface ChoreActionFacts {
	type: 'rotation' | 'personal';
	/** False when the chore doesn't occur today (a weekends chore on a weekday). */
	dueToday: boolean;
	/** An open (not reopened) completion exists for this period. */
	completed: boolean;
	/** The rotation's turn-holder, or the personal chore's assignee; null if nobody. */
	holderId: string | null;
	/** A personal chore already skipped for this period. */
	alreadySkipped?: boolean;
	/** Stage progress exists on this period's instance: the turn is under way. */
	started?: boolean;
}

export type ActionPlan =
	| { ok: true; holderId: string; noop?: boolean }
	| { ok: false; status: 409; message: string };

const refuse = (message: string): ActionPlan => ({
	ok: false,
	status: 409,
	message,
});

/** Shared checks: the chore must be due, unfinished and held by someone. */
function openHolder(facts: ChoreActionFacts): ActionPlan {
	if (!facts.dueToday) return refuse("This chore isn't due today.");
	if (facts.completed) return refuse('This chore is already done for now.');
	if (!facts.holderId) {
		return refuse(
			facts.type === 'rotation'
				? 'Nobody is eligible to take this turn.'
				: 'This chore has nobody assigned.',
		);
	}
	return { ok: true, holderId: facts.holderId };
}

/**
 * Skip: a rotation moves its turn on; a personal chore is marked skipped for
 * the period. Skipping a personal chore twice is a no-op, not an error.
 */
export function planSkip(facts: ChoreActionFacts): ActionPlan {
	const plan = openHolder(facts);
	if (!plan.ok) return plan;
	// Moving the turn on would strand the stage progress on the skipped member.
	if (facts.type === 'rotation' && facts.started) {
		return refuse(
			'Stages are already under way on this turn. Finish or reopen it instead.',
		);
	}
	if (facts.type === 'personal' && facts.alreadySkipped) {
		return { ...plan, noop: true };
	}
	return plan;
}

/** Remind: nudge whoever holds the chore; there's nothing to nudge once it's done. */
export function planRemind(facts: ChoreActionFacts): ActionPlan {
	return openHolder(facts);
}
