// What the Household Overview (SB-46) shows, as plain data that the server
// load, the components and the tests share. No server imports here: this
// file is bundled into the client.

export type ChoreStatus = 'active-turn' | 'staged' | 'todo' | 'completed';

export interface OverviewAssignee {
	memberId: string;
	name: string;
}

/** One chore that is due in the current period, as a Chore Status row. */
export interface ChoreStatusRow {
	/** The chore (definition) id. */
	choreId: string;
	/** Today's `chore_instances` row, or null if nobody has touched the chore yet. */
	instanceId: string | null;
	/** The open completion, when the chore is done; used to reopen it. */
	completionId: string | null;
	title: string;
	/** Second line: the loop or owner, and when it is due. */
	context: string;
	assignee: OverviewAssignee | null;
	status: ChoreStatus;
	points: number;
	/** Rotation chores can be opened in the Rotation Loops Builder. */
	isLoop: boolean;
}

export interface OverviewStats {
	totalChores: number;
	sharedLoops: number;
	personalChores: number;
	activeRotations: number;
	rotationsDueSoon: number;
	/** Names of loops still open today (the "need attention" caption). */
	dueSoonTitles: string[];
	completedToday: number;
	dueToday: number;
	/** Whole percent, 0 when nothing is due. */
	completedPercent: number;
	/** Consecutive days with at least one completion; see `familyStreakDays`. */
	streakDays: number;
	/** Active rotation exclusions (members skipped by a loop). */
	exceptions: number;
	/** One sentence about the first exclusion, or null. */
	firstException: string | null;
}

export interface HouseholdOverview {
	stats: OverviewStats;
	rows: ChoreStatusRow[];
}

export const isOpen = (row: Pick<ChoreStatusRow, 'status'>) =>
	row.status !== 'completed';

/** Open rows first (in the order given), then completed ones. */
export function sortRows(rows: ChoreStatusRow[]): ChoreStatusRow[] {
	return [...rows.filter(isOpen), ...rows.filter((r) => !isOpen(r))];
}

export const openCount = (rows: ChoreStatusRow[]) => rows.filter(isOpen).length;

export const percentOf = (done: number, total: number) =>
	total <= 0 ? 0 : Math.round((done / total) * 100);

export const plural = (n: number, one: string, many = `${one}s`) =>
	`${n} ${n === 1 ? one : many}`;

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
	if (names.length <= 1) return names.join('');
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The actions a row offers: Skip and Remind while open, Reopen and View Loop once done. */
export function rowActions(row: ChoreStatusRow) {
	return {
		skip: isOpen(row),
		remind: isOpen(row),
		reopen: !isOpen(row),
		viewLoop: !isOpen(row) && row.isLoop,
	};
}

/**
 * Interim family streak until SB-28 lands: how many consecutive local days,
 * counting back from `today` (or from yesterday while today has no
 * completion yet), have at least one completion. `days` are `YYYY-MM-DD`.
 */
export function familyStreakDays(
	days: Iterable<string>,
	today: string,
): number {
	const set = new Set(days);
	let day = set.has(today) ? today : shiftDay(today, -1);
	let streak = 0;
	while (set.has(day)) {
		streak++;
		day = shiftDay(day, -1);
	}
	return streak;
}

function shiftDay(date: string, delta: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().slice(0, 10);
}

/** The "due" part of a row's context line. */
export function dueText(input: {
	status: ChoreStatus;
	stageProgress: { done: number; total: number } | null;
	dueLabel: string | null;
	dueTime: string | null;
	frequency: 'daily' | 'weekly' | 'weekends';
}): string {
	if (input.status === 'completed') return 'done';
	const stages = input.stageProgress;
	if (stages && stages.total > 0) {
		return `stage ${Math.min(stages.done + 1, stages.total)} of ${stages.total}`;
	}
	if (input.dueLabel) return input.dueLabel;
	if (input.dueTime) return `by ${formatTime(input.dueTime)}`;
	if (input.frequency === 'weekly') return 'due this week';
	if (input.frequency === 'weekends') return 'due this weekend';
	return 'due today';
}

/** "20:00:00" -> "8:00 PM". */
export function formatTime(time: string): string {
	const [h = '0', m = '00'] = time.split(':');
	const hour = Number(h);
	return `${hour % 12 || 12}:${m.padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
