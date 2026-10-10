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

/** One member's share of today's chores, for the Member Workload panel. */
export interface MemberWorkload {
	memberId: string;
	name: string;
	/** Open chores assigned to them today. */
	active: number;
	/** Chores they completed today. */
	done: number;
	/** One line about what they have on; see `workloadSummary`. */
	summary: string;
	/** Bar fill, 0-100, relative to the busiest member (`active + done`). */
	barPercent: number;
}

export type WorkloadBalance = 'balanced' | 'unbalanced';

export interface WorkloadOverview {
	members: MemberWorkload[];
	balance: WorkloadBalance;
}

/** One rotation in the Upcoming Rotations panel. */
export interface UpcomingRotation {
	choreId: string;
	title: string;
	/** "Next handoff at 8:00 PM". */
	handoff: string;
	/** Open today, so it counts towards the "N due today" badge. */
	dueToday: boolean;
	/** Eligible members from the current turn to the end of the loop, in order. */
	order: string[];
}

export type NoteTone = 'warning' | 'info' | 'success';

/** A generated note in Exceptions & Notes. */
export interface OverviewNote {
	tone: NoteTone;
	text: string;
	/** Only exclusion notes are rules; they feed the "N active rules" badge. */
	kind: 'exclusion' | 'priority' | 'unblocked';
}

export interface HouseholdOverview {
	stats: OverviewStats;
	rows: ChoreStatusRow[];
	workload: WorkloadOverview;
	rotations: UpcomingRotation[];
	notes: OverviewNote[];
}

/**
 * Balanced vs unbalanced, for the Member Workload badge. `loads` is each
 * household member's chores today, open plus done (members with nothing count
 * as 0). The household is unbalanced when BOTH hold:
 *
 * - the busiest member has at least 3 more chores than the lightest, and
 * - the busiest member has more than 1.5x the average load.
 *
 * The first rule ignores small gaps (2 vs 0 is fine); the second stops one idle
 * member from flagging an otherwise even split (3, 3, 3, 0). With fewer than 2
 * members, or fewer than 3 chores in total, there is nothing to balance.
 * Tune the two numbers below if this proves too strict or too loose.
 */
export const UNBALANCED_MIN_SPREAD = 3;
export const UNBALANCED_MAX_OVER_MEAN = 1.5;

export function workloadBalance(loads: number[]): WorkloadBalance {
	const total = loads.reduce((a, b) => a + b, 0);
	if (loads.length < 2 || total < 3) return 'balanced';
	const max = Math.max(...loads);
	const min = Math.min(...loads);
	const mean = total / loads.length;
	return max - min >= UNBALANCED_MIN_SPREAD &&
		max > UNBALANCED_MAX_OVER_MEAN * mean
		? 'unbalanced'
		: 'balanced';
}

const titleList = (titles: string[]) =>
	titles.length <= 2
		? joinNames(titles)
		: `${titles.slice(0, 2).join(', ')} and ${titles.length - 2} more`;

/** The one-line summary under a member's bar. */
export function workloadSummary(
	activeTitles: string[],
	doneTitles: string[],
): string {
	if (activeTitles.length === 0 && doneTitles.length === 0) {
		return 'Nothing assigned today.';
	}
	if (doneTitles.length === 0) return `${titleList(activeTitles)} in progress.`;
	if (activeTitles.length === 0) return `${titleList(doneTitles)} completed.`;
	return `${titleList(activeTitles)} in progress; ${titleList(doneTitles)} completed.`;
}

/** Today's chores per member, busiest first (ties by name). */
export function buildWorkload(
	members: { id: string; name: string }[],
	items: { memberId: string; title: string; done: boolean }[],
): WorkloadOverview {
	const counts = members.map((m) => {
		const mine = items.filter((i) => i.memberId === m.id);
		return {
			m,
			activeTitles: mine.filter((i) => !i.done).map((i) => i.title),
			doneTitles: mine.filter((i) => i.done).map((i) => i.title),
		};
	});
	const loads = counts.map((c) => c.activeTitles.length + c.doneTitles.length);
	const max = Math.max(0, ...loads);
	const list = counts
		.map(({ m, activeTitles, doneTitles }) => ({
			memberId: m.id,
			name: m.name,
			active: activeTitles.length,
			done: doneTitles.length,
			summary: workloadSummary(activeTitles, doneTitles),
			barPercent: percentOf(activeTitles.length + doneTitles.length, max),
		}))
		.sort(
			(a, b) =>
				b.active + b.done - (a.active + a.done) || a.name.localeCompare(b.name),
		);
	return { members: list, balance: workloadBalance(loads) };
}

/**
 * The loop from the current turn onwards: eligible members by position, from
 * `currentMemberId` to the end of the loop (the Loop Reset follows). Empty when
 * the current member isn't in the loop.
 */
export function rotationChain(
	members: {
		memberId: string;
		name: string;
		position: number;
		eligible: boolean;
	}[],
	currentMemberId: string | null,
): string[] {
	const eligible = members
		.filter((m) => m.eligible)
		.sort((a, b) => a.position - b.position);
	const at = eligible.findIndex((m) => m.memberId === currentMemberId);
	return at < 0 ? [] : eligible.slice(at).map((m) => m.name);
}

/** "Next handoff at 8:00 PM"; once today's turn is done, the next period. */
export function handoffText(input: {
	dueToday: boolean;
	dueTime: string | null;
	dueLabel: string | null;
	frequency: 'daily' | 'weekly' | 'weekends';
}): string {
	if (!input.dueToday) {
		const next = {
			daily: 'tomorrow',
			weekly: 'next week',
			weekends: 'next weekend',
		}[input.frequency];
		return `Next handoff ${next}`;
	}
	if (input.dueTime) return `Next handoff at ${formatTime(input.dueTime)}`;
	if (input.dueLabel) return `Next handoff ${input.dueLabel}`;
	if (input.frequency === 'weekly') return 'Next handoff this week';
	if (input.frequency === 'weekends') return 'Next handoff this weekend';
	return 'Next handoff today';
}

/**
 * The generated notes, warnings first. All generated for now; notes a parent
 * writes would need their own table.
 *
 * - warning: each active exclusion rule (pass them as sentences);
 * - info: the open loop worth the most points today (first on a tie);
 * - success: loops completed today, naming whose turn is up next (at most 2).
 */
export function buildNotes(input: {
	exclusions: string[];
	rows: ChoreStatusRow[];
	/** Who holds the turn now, by chore id. */
	currentTurn: Map<string, string>;
}): OverviewNote[] {
	const notes: OverviewNote[] = input.exclusions.map((text) => ({
		tone: 'warning',
		kind: 'exclusion',
		text,
	}));
	const loops = input.rows.filter((r) => r.isLoop);
	const top = loops
		.filter(isOpen)
		.reduce<ChoreStatusRow | null>(
			(best, r) => (!best || r.points > best.points ? r : best),
			null,
		);
	if (top) {
		notes.push({
			tone: 'info',
			kind: 'priority',
			text: `${top.title} is the highest-value active rotation today (${top.points} pts).`,
		});
	}
	for (const r of loops.filter((r) => !isOpen(r)).slice(0, 2)) {
		const next = input.currentTurn.get(r.choreId);
		notes.push({
			tone: 'success',
			kind: 'unblocked',
			text: next
				? `${r.title} is done, so ${next} is up next.`
				: `${r.title} is done.`,
		});
	}
	return notes;
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
