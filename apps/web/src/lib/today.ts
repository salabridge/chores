// What the Today screen (SB-39) shows, as plain data that the server load, the
// components and the tests share. No server imports here: this file is bundled
// into the client.

import { formatTime, plural } from './overview.ts';

export type TodayStatus = 'in-progress' | 'todo' | 'my-turn' | 'completed';

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
}

type Frequency = 'daily' | 'weekly' | 'weekends';

/** A personal chore due today to the viewer, as the server found it. */
export interface PersonalFacts {
	choreId: string;
	title: string;
	points: number;
	frequency: Frequency;
	dueTime: string | null;
	dueLabel: string | null;
	stages: { done: number; total: number };
	completed: boolean;
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
}

export const choreHref = (choreId: string) => `/chores/${choreId}`;

const RANK: Record<TodayStatus, number> = {
	'in-progress': 0,
	'my-turn': 1,
	todo: 1,
	completed: 2,
};

/**
 * In progress first, then to do, then completed. Within a group a rotation
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

function dueText(
	f: Pick<PersonalFacts, 'dueLabel' | 'dueTime' | 'frequency'>,
): string {
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

/** "Stage 2 of 3 • Continue where you left off", "Due by 8:00 PM", ... */
export function personalSubtitle(
	f: Pick<
		PersonalFacts,
		'completed' | 'stages' | 'dueLabel' | 'dueTime' | 'frequency'
	>,
): string {
	if (f.completed) return 'Done for today';
	if (hasStarted(f.stages)) {
		return `Stage ${currentStage(f.stages)} of ${f.stages.total} • Continue where you left off`;
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
	if (f.turnMemberId === viewerId) {
		const started = hasStarted(f.stages);
		return {
			...base,
			subtitle: started
				? `Household rotation • Stage ${currentStage(f.stages)} of ${f.stages.total}`
				: 'Household rotation • Open the loop details',
			points: f.points,
			status: started ? 'in-progress' : 'my-turn',
			variant: 'highlighted',
			myTurn: true,
		};
	}
	return {
		...base,
		subtitle: f.turnMemberName
			? `Shared rotation • ${f.turnMemberName} has the turn`
			: 'Shared rotation • Nobody has the turn',
		points: f.points,
		status: null,
		variant: 'shared',
		myTurn: false,
	};
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

/** Everything the screen needs, from the facts the server loaded. */
export function buildToday(input: {
	member: { id: string; name: string };
	points: number;
	streak: TodayStreak;
	personal: readonly PersonalFacts[];
	rotations: readonly RotationFacts[];
}): TodayData {
	const personal = sortTodayItems(input.personal.map(personalItem));
	const rotations = sortTodayItems(
		input.rotations.map((r) => rotationItem(r, input.member.id)),
	);
	return {
		member: input.member,
		points: input.points,
		streak: input.streak,
		summary: summarize(personal, rotations),
		priority: pickPriority(rotations),
		personal,
		rotations,
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
