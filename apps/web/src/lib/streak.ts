import { addDays, chorePeriodStart } from '@chore/db/recurrence';
import { type DueChore, memberDayStatus, type Streak } from '@chore/db/streaks';
import { plural } from './overview.ts';
import {
	type Momentum,
	nextStreakGoal,
	type SuggestedChore,
	streakMomentum,
} from './rewards-shop.ts';

// What the Streak tab (SB-44) shows: the member's active streak (SB-28), this
// week's activity, and the same momentum card as the Rewards shop. Pure, so
// the load, the components and the tests share it.

/** One day in the week calendar. */
export interface StreakWeekDay {
	date: string;
	/** "M", "T", ... */
	letter: string;
	dayOfMonth: number;
	/** The member completed everything due to them that day. */
	active: boolean;
}

export interface StreakWeek {
	/** "Oct 5–11", or "Sep 29–Oct 5" across a month. */
	label: string;
	/** ISO week number. */
	number: number;
	days: StreakWeekDay[];
	/** Chores due to the member so far this week, and how many got done. */
	done: number;
	due: number;
	/** Points earned from completions since Monday. */
	points: number;
}

export interface StreakScreenData {
	name: string;
	points: number;
	streak: Streak;
	/** The next streak length to aim for. */
	goal: number;
	/** How the rest of the household compares, e.g. "Mia is catching up!". */
	note: string | null;
	week: StreakWeek;
	momentum: Momentum;
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

const monthDay = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC',
});
const month = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	timeZone: 'UTC',
});

/** "Oct 5–11" for a Monday–Sunday week, "Sep 29–Oct 5" when it spans two months. */
export function weekLabel(monday: string): string {
	const sunday = addDays(monday, 6);
	const end =
		month.format(utc(monday)) === month.format(utc(sunday))
			? String(utc(sunday).getUTCDate())
			: monthDay.format(utc(sunday));
	return `${monthDay.format(utc(monday))}–${end}`;
}

/** The ISO 8601 week number of a `YYYY-MM-DD` date. */
export function isoWeek(date: string): number {
	const d = utc(date);
	// The week's Thursday decides which year the week belongs to.
	d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
	const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
	return Math.floor((d.getTime() - jan1) / (7 * 86_400_000)) + 1;
}

/**
 * The line under the streak count, from whoever else in the household has
 * the longest streak going. Null when nobody else has one.
 */
export function streakNote(
	days: number,
	others: readonly { name: string; days: number }[],
): string | null {
	const top = others
		.filter((o) => o.days > 0)
		.toSorted((a, b) => b.days - a.days)[0];
	if (!top) return null;
	if (top.days < days) return `${top.name} is catching up!`;
	if (top.days === days) return `${top.name} is right there with you!`;
	return `${top.name} is on a ${top.days}-day streak!`;
}

/** "Next up: 7 active days" and "2 more days" under the streak. */
export function nextUp(streak: { days: number }, goal: number) {
	return {
		label: `Next up: ${goal} active days`,
		remaining: plural(goal - streak.days, 'more day'),
	};
}

/**
 * The member's week so far, Monday to Sunday. A day is active when they did
 * everything due to them (the same rule as the streak); today only lights up
 * once that's true. Weekly chores count on their Sunday, as in the streak.
 */
export function streakWeek(input: {
	memberId: string;
	today: string;
	due: readonly DueChore[];
	points: number;
}): StreakWeek {
	const monday = chorePeriodStart('weekly', input.today) ?? input.today;
	const sunday = addDays(monday, 6);
	const mine = input.due.filter(
		(c) =>
			c.memberId === input.memberId && c.date >= monday && c.date <= sunday,
	);
	const counted = mine.filter((c) => c.outcome !== 'skipped');
	return {
		label: weekLabel(monday),
		number: isoWeek(monday),
		days: LETTERS.map((letter, i) => {
			const date = addDays(monday, i);
			return {
				date,
				letter,
				dayOfMonth: utc(date).getUTCDate(),
				active:
					memberDayStatus(mine.filter((c) => c.date === date)) === 'qualified',
			};
		}),
		done: counted.filter((c) => c.outcome === 'done').length,
		due: counted.length,
		points: input.points,
	};
}

/** Everything the Streak tab renders. */
export function buildStreakScreen(input: {
	member: { id: string; name: string };
	members: readonly { id: string; name: string }[];
	streaks: { today: string; members: Record<string, Streak>; due: DueChore[] };
	balance: number;
	weekPoints: number;
	suggested: readonly SuggestedChore[];
}): StreakScreenData {
	const { member, streaks } = input;
	const streak = streaks.members[member.id] ?? { days: 0, exceptions: 0 };
	return {
		name: member.name,
		points: input.balance,
		streak,
		goal: nextStreakGoal(streak.days),
		note: streakNote(
			streak.days,
			input.members
				.filter((m) => m.id !== member.id)
				.map((m) => ({ name: m.name, days: streaks.members[m.id]?.days ?? 0 })),
		),
		week: streakWeek({
			memberId: member.id,
			today: streaks.today,
			due: streaks.due,
			points: input.weekPoints,
		}),
		momentum: streakMomentum(streak.days, input.suggested),
	};
}
