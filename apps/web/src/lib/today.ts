// What the Today screen (SB-39) shows, as plain data that the server load, the
// components and the tests share. No server imports here: this file is bundled
// into the client.

import { choreDueDate, dueDayState } from '@chore/db/recurrence';
import { doneByText, possessive } from './favour.ts';
import { formatTime, plural } from './overview.ts';
import type { StreakWeek } from './streak.ts';
import {
	type DueDayState,
	dueDayText,
	type IsoWeekday,
	isIsoWeekday,
} from './weekdays.ts';

export type TodayStatus =
	| 'in-progress'
	| 'todo'
	| 'my-turn'
	| 'completed'
	| 'overdue';

export type TodayVariant = 'personal' | 'shared' | 'highlighted' | 'completed';

/** One chore card: a personal chore or a household rotation. */
export interface TodayItem {
	choreId: string;
	title: string;
	subtitle: string;
	/** Hidden on the card once the chore is done. */
	points: number | null;
	/** `null` shows no badge (a rotation that is someone else's turn). */
	status: TodayStatus | null;
	variant: TodayVariant;
	/** The viewer holds the turn of an open rotation. */
	myTurn: boolean;
	/** Where the card links to. */
	href: string;
}

/**
 * Another member's open chore the viewer could pick up (SB-75). Doing it
 * credits the viewer with the points; it stays the owner's chore.
 */
export interface HelpOutItem {
	choreId: string;
	title: string;
	ownerId: string;
	ownerName: string;
	subtitle: string;
	points: number;
	overdue: boolean;
	href: string;
}

export interface TodayPriority {
	choreId: string;
	title: string;
	points: number;
}

export interface TodaySummary {
	/** Personal chores still to do today. */
	personalCount: number;
	/** Points those chores are worth. */
	personalPoints: number;
	/** Rotations the viewer is part of today. */
	loopCount: number;
	/** Points on rotations that are the viewer's turn right now. */
	availablePoints: number;
}

export interface TodayStreak {
	days: number;
	exceptions: number;
}

export interface TodayData {
	member: { id: string; name: string };
	points: number;
	streak: TodayStreak;
	summary: TodaySummary;
	priority: TodayPriority | null;
	personal: TodayItem[];
	rotations: TodayItem[];
	/**
	 * Weekly chores due later this week (SB-71), personal and rotations
	 * together, by day. Not counted in the summary: they aren't due today.
	 */
	later: TodayItem[];
	/**
	 * Other members' chores that are open now, for the collapsed "Help out"
	 * section (SB-75). Not counted in the summary: they aren't the viewer's.
	 */
	helpOut: HelpOutItem[];
	/** The Weekly Progress card (SB-68): the same week the Streak tab shows. */
	week: StreakWeek;
}

type Frequency = 'daily' | 'weekly' | 'weekends';

/**
 * The day a weekly chore is due this week (SB-71) and how today relates to
 * it. Null for chores without one, which are due any time in their period.
 */
export interface DueDay {
	weekday: IsoWeekday;
	state: DueDayState;
}

/**
 * The due day of a chore in the period starting `periodStart`, seen from
 * `today` (both household-local dates), or null when it has none.
 */
export function dueDayFor(
	chore: { frequency: Frequency; dueWeekday: number | null },
	periodStart: string,
	today: string,
): DueDay | null {
	if (!isIsoWeekday(chore.dueWeekday)) return null;
	const dueDate = choreDueDate(chore.frequency, periodStart, chore.dueWeekday);
	return dueDate
		? { weekday: chore.dueWeekday, state: dueDayState(today, dueDate) }
		: null;
}

/** A personal chore due today to the viewer, as the server found it. */
export interface PersonalFacts {
	choreId: string;
	title: string;
	points: number;
	frequency: Frequency;
	dueTime: string | null;
	dueLabel: string | null;
	/** A weekly chore's due day (SB-71); null when it has none. */
	due: DueDay | null;
	stages: { done: number; total: number };
	completed: boolean;
	/** Who did it when it wasn't the viewer (SB-74, a favour); null otherwise. */
	doneByName: string | null;
}

/** An open chore of another member, as the server found it (SB-75). */
export interface HelpOutFacts {
	kind: 'personal' | 'rotation';
	choreId: string;
	title: string;
	points: number;
	/** Whose chore it is: the assignee, or the holder of the rotation's turn. */
	ownerId: string;
	ownerName: string;
	frequency: Frequency;
	dueTime: string | null;
	dueLabel: string | null;
	due: DueDay | null;
	stages: { done: number; total: number };
}

/** A rotation the viewer is part of that occurs today, as the server found it. */
export interface RotationFacts {
	choreId: string;
	title: string;
	points: number;
	/** Whoever holds the turn now (null if nobody is eligible). */
	turnMemberId: string | null;
	turnMemberName: string | null;
	stages: { done: number; total: number };
	completed: boolean;
	/** Name of the member who finished this period's turn. */
	completedByName: string | null;
	/** A weekly chore's due day (SB-71); null when it has none. */
	due: DueDay | null;
}

export const choreHref = (choreId: string) => `/chores/${choreId}`;

const RANK: Record<TodayStatus, number> = {
	overdue: 0,
	'in-progress': 1,
	'my-turn': 2,
	todo: 2,
	completed: 3,
};

/**
 * Overdue first, then in progress, then to do, then completed. Within a group a rotation
 * that is the viewer's turn comes first, then bigger point values, then
 * alphabetical, so the order doesn't depend on how the rows came back.
 */
export function sortTodayItems(items: readonly TodayItem[]): TodayItem[] {
	const rank = (i: TodayItem) => RANK[i.status ?? 'todo'];
	return [...items].sort(
		(a, b) =>
			rank(a) - rank(b) ||
			Number(b.myTurn) - Number(a.myTurn) ||
			(b.points ?? 0) - (a.points ?? 0) ||
			a.title.localeCompare(b.title),
	);
}

/** "Due Thu", "Was due Thu", or null without a due day. */
const dueDayPart = (due: DueDay | null) =>
	due ? dueDayText(due.state, due.weekday) : null;

const isOverdue = (due: DueDay | null) => due?.state === 'overdue';

function dueText(
	f: Pick<PersonalFacts, 'dueLabel' | 'dueTime' | 'frequency' | 'due'>,
): string {
	const day = dueDayPart(f.due);
	if (day) {
		if (f.dueLabel) return `${day} · ${f.dueLabel}`;
		if (f.dueTime) return `${day} by ${formatTime(f.dueTime)}`;
		return day;
	}
	if (f.dueLabel) return `Due ${f.dueLabel}`;
	if (f.dueTime) return `Due by ${formatTime(f.dueTime)}`;
	if (f.frequency === 'weekly') return 'Due this week';
	if (f.frequency === 'weekends') return 'Due this weekend';
	return 'Due today';
}

const hasStarted = (stages: { done: number; total: number }) =>
	stages.total > 0 && stages.done > 0;

const currentStage = (stages: { done: number; total: number }) =>
	Math.min(stages.done + 1, stages.total);

/** "Stage 2 of 3 • Continue where you left off", "Due by 8:00 PM", "Due Thu", ... */
export function personalSubtitle(
	f: Pick<
		PersonalFacts,
		| 'completed'
		| 'stages'
		| 'dueLabel'
		| 'dueTime'
		| 'frequency'
		| 'due'
		| 'doneByName'
	>,
): string {
	if (f.completed) {
		return f.doneByName ? doneByText(f.doneByName) : 'Done for today';
	}
	if (hasStarted(f.stages)) {
		const tail = isOverdue(f.due)
			? dueDayPart(f.due)
			: 'Continue where you left off';
		return `Stage ${currentStage(f.stages)} of ${f.stages.total} • ${tail}`;
	}
	return dueText(f);
}

export function personalItem(f: PersonalFacts): TodayItem {
	return {
		choreId: f.choreId,
		title: f.title,
		subtitle: personalSubtitle(f),
		points: f.completed ? null : f.points,
		status: f.completed
			? 'completed'
			: hasStarted(f.stages)
				? 'in-progress'
				: isOverdue(f.due)
					? 'overdue'
					: 'todo',
		variant: f.completed ? 'completed' : 'personal',
		myTurn: false,
		href: choreHref(f.choreId),
	};
}

export function rotationItem(f: RotationFacts, viewerId: string): TodayItem {
	const base = {
		choreId: f.choreId,
		title: f.title,
		href: choreHref(f.choreId),
	};
	if (f.completed) {
		return {
			...base,
			subtitle: f.completedByName
				? `Shared rotation • Completed by ${f.completedByName}`
				: 'Shared rotation • Completed',
			points: null,
			status: 'completed',
			variant: 'completed',
			myTurn: false,
		};
	}
	const day = dueDayPart(f.due);
	if (f.turnMemberId === viewerId) {
		const started = hasStarted(f.stages);
		const stage = `Household rotation • Stage ${currentStage(f.stages)} of ${f.stages.total}`;
		return {
			...base,
			subtitle: started
				? isOverdue(f.due)
					? `${stage} • ${day}`
					: stage
				: `Household rotation • ${day ?? 'Open the loop details'}`,
			points: f.points,
			status: started
				? 'in-progress'
				: isOverdue(f.due)
					? 'overdue'
					: 'my-turn',
			variant: 'highlighted',
			myTurn: true,
		};
	}
	const turn = f.turnMemberName
		? `Shared rotation • ${f.turnMemberName} has the turn`
		: 'Shared rotation • Nobody has the turn';
	return {
		...base,
		subtitle: day ? `${turn} • ${day}` : turn,
		points: f.points,
		status: null,
		variant: 'shared',
		myTurn: false,
	};
}

/** "Leo's chore • Due by 8:00 PM", "Leo's chore • Stage 2 of 3". */
export function helpOutSubtitle(f: HelpOutFacts): string {
	const owner = `${possessive(f.ownerName)} chore`;
	if (hasStarted(f.stages)) {
		return `${owner} • Stage ${currentStage(f.stages)} of ${f.stages.total}`;
	}
	if (f.kind === 'rotation') {
		const day = dueDayPart(f.due);
		return day
			? `${owner} • Household rotation • ${day}`
			: `${owner} • Household rotation`;
	}
	return `${owner} • ${dueText(f)}`;
}

export function helpOutItem(f: HelpOutFacts): HelpOutItem {
	return {
		choreId: f.choreId,
		title: f.title,
		ownerId: f.ownerId,
		ownerName: f.ownerName,
		subtitle: helpOutSubtitle(f),
		points: f.points,
		overdue: isOverdue(f.due),
		href: choreHref(f.choreId),
	};
}

/** Overdue first, then by owner, then biggest points, then title. */
export function sortHelpOut(items: readonly HelpOutItem[]): HelpOutItem[] {
	return [...items].sort(
		(a, b) =>
			Number(b.overdue) - Number(a.overdue) ||
			a.ownerName.localeCompare(b.ownerName) ||
			b.points - a.points ||
			a.title.localeCompare(b.title),
	);
}

/**
 * The highest-value open rotation where it's the viewer's turn, or null. Ties
 * go to the title that sorts first, so the pick is stable.
 */
export function pickPriority(
	rotations: readonly TodayItem[],
): TodayPriority | null {
	const [best] = rotations
		.filter((r) => r.myTurn && r.status !== 'completed' && r.points !== null)
		.sort(
			(a, b) =>
				(b.points ?? 0) - (a.points ?? 0) || a.title.localeCompare(b.title),
		);
	return best
		? { choreId: best.choreId, title: best.title, points: best.points ?? 0 }
		: null;
}

export function summarize(
	personal: readonly TodayItem[],
	rotations: readonly TodayItem[],
): TodaySummary {
	const open = personal.filter((p) => p.status !== 'completed');
	return {
		personalCount: open.length,
		personalPoints: open.reduce((n, p) => n + (p.points ?? 0), 0),
		loopCount: rotations.length,
		availablePoints: rotations
			.filter((r) => r.myTurn)
			.reduce((n, r) => n + (r.points ?? 0), 0),
	};
}

/**
 * A weekly chore that isn't due until a later day this week and isn't done
 * yet. It goes in the collapsed "Later this week" group instead of today's
 * lists (SB-71). One done early stays in today's list as completed.
 */
const isLater = (f: { due: DueDay | null; completed: boolean }) =>
	f.due?.state === 'upcoming' && !f.completed;

/** Everything the screen needs, from the facts the server loaded. */
export function buildToday(input: {
	member: { id: string; name: string };
	points: number;
	streak: TodayStreak;
	week: StreakWeek;
	personal: readonly PersonalFacts[];
	rotations: readonly RotationFacts[];
	/** Other members' open chores (SB-75); leave out the ones not due yet. */
	helpOut?: readonly HelpOutFacts[];
}): TodayData {
	const personal = sortTodayItems(
		input.personal.filter((f) => !isLater(f)).map(personalItem),
	);
	const rotations = sortTodayItems(
		input.rotations
			.filter((f) => !isLater(f))
			.map((r) => rotationItem(r, input.member.id)),
	);
	// By day, then title, personal and rotations mixed.
	const later = [
		...input.personal
			.filter(isLater)
			.map((f) => ({ day: f.due?.weekday ?? 0, item: personalItem(f) })),
		...input.rotations.filter(isLater).map((f) => ({
			day: f.due?.weekday ?? 0,
			item: rotationItem(f, input.member.id),
		})),
	]
		.sort((a, b) => a.day - b.day || a.item.title.localeCompare(b.item.title))
		.map(({ item }) => item);
	return {
		member: input.member,
		points: input.points,
		streak: input.streak,
		summary: summarize(personal, rotations),
		priority: pickPriority(rotations),
		personal,
		rotations,
		later,
		helpOut: sortHelpOut((input.helpOut ?? []).map(helpOutItem)),
		week: input.week,
	};
}

/** Streak banner headline. */
export function streakTitle(streak: TodayStreak): string {
	return streak.days > 0
		? `${streak.days}-Day Active Streak!`
		: 'Start a streak today!';
}

/** Streak banner supporting line, or null. */
export function streakNote(
	streak: TodayStreak,
	openChores: number,
): string | null {
	if (streak.days === 0) {
		return openChores > 0 ? 'Finish everything due today to begin one.' : null;
	}
	const parts = [
		openChores > 0
			? `${plural(openChores, 'chore')} left today to keep it going.`
			: "You're all caught up today!",
	];
	if (streak.exceptions > 0) {
		parts.push(`Includes ${plural(streak.exceptions, 'exception')}.`);
	}
	return parts.join(' ');
}
