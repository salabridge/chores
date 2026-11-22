import { addDays, choreDueDate, chorePeriodStart } from '@chore/db/recurrence';
import { nextEligibleMember, type RotationSlot } from '@chore/db/rotation';
import type { ChoreFrequency } from '@chore/db/schema';

// The household calendar feed (SB-101): an iCalendar (RFC 5545) document that
// Google Calendar, Thunderbird, Notion Calendar and the like can subscribe to.
// Everything here is pure, so the recurrence, rotation and escaping rules can
// be tested without a database; `./server/calendar.ts` loads the rows.

/** How many days ahead of today the feed lists chores. */
export const CALENDAR_WINDOW_DAYS = 56;
/** How many days back the feed keeps, so last week isn't an empty calendar. */
export const CALENDAR_LOOKBACK_DAYS = 7;
/** How long a chore with a due time shows for on the calendar, in minutes. */
const TIMED_EVENT_MINUTES = 30;

export interface CalendarChore {
	id: string;
	title: string;
	/** The "Parent Note". */
	description: string | null;
	type: 'personal' | 'rotation';
	frequency: ChoreFrequency;
	/** `HH:MM:SS` in the household's time zone, or null. */
	dueTime: string | null;
	/** Free-text due label ("after dinner"), shown when there's no clock time. */
	dueLabel: string | null;
	dueWeekday: number | null;
	assignedMemberId: string | null;
	updatedAt: Date;
}

/** A rotation chore's loop and where it stands (`chore_rotations` plus its members). */
export interface CalendarRotation {
	choreId: string;
	currentMemberId: string | null;
	members: RotationSlot[];
}

/** Who a period was fixed to when its `chore_instances` row was made. */
export interface CalendarInstance {
	choreId: string;
	periodStart: string;
	assignedMemberId: string | null;
}

export interface CalendarInput {
	householdName: string;
	timeZone: string;
	/** The household's local date today (`YYYY-MM-DD`). */
	today: string;
	/** When the feed was made, for `DTSTAMP`. */
	now: Date;
	chores: CalendarChore[];
	rotations: CalendarRotation[];
	instances: CalendarInstance[];
	/** Display names by `household_members.id`. */
	memberNames: ReadonlyMap<string, string>;
}

/** One chore in one period, before it's turned into a calendar entry. */
export interface ChoreOccurrence {
	chore: CalendarChore;
	/** The period's first local date, as in `chore_instances.period_start`. */
	periodStart: string;
	/** The local date the entry starts on. */
	date: string;
	/** Days it spans (a weekly chore with no due day covers its whole week). */
	days: number;
	assigneeId: string | null;
}

const key = (choreId: string, periodStart: string) =>
	`${choreId}|${periodStart}`;

/**
 * Every period of `chore` that overlaps `from` through `to`, oldest first, as
 * `{ periodStart, date, days }`.
 */
function periodsBetween(
	chore: CalendarChore,
	from: string,
	to: string,
): { periodStart: string; date: string; days: number }[] {
	const out: { periodStart: string; date: string; days: number }[] = [];
	if (chore.frequency === 'weekly') {
		// The week containing `from` through the week containing `to`.
		let monday = chorePeriodStart('weekly', from) as string;
		for (; monday <= to; monday = addDays(monday, 7)) {
			const due = choreDueDate('weekly', monday, chore.dueWeekday);
			const period = due
				? { periodStart: monday, date: due, days: 1 }
				: { periodStart: monday, date: monday, days: 7 };
			// The first week can start before `from` (and a due day in it can be
			// before `from` too). Keep it only if the entry reaches into the window.
			if (addDays(period.date, period.days) > from) out.push(period);
		}
		return out;
	}
	for (let day = from; day <= to; day = addDays(day, 1)) {
		// `daily` is every day; `weekends` returns null on a weekday.
		const periodStart = chorePeriodStart(chore.frequency, day);
		if (periodStart) out.push({ periodStart, date: day, days: 1 });
	}
	return out;
}

/**
 * The chores that fall in the feed's window, with whoever has each one.
 *
 * - A personal chore goes to the person it was fixed to for that period, else
 *   the chore's own assignee.
 * - A rotation chore goes to the member its period was fixed to. Periods that
 *   haven't started and have no fixed turn are projected: the active turn, then
 *   each hand-off in loop order. That's a forecast (skips and completions move
 *   the turn), and the feed reads fresh each time it's fetched.
 * - Past periods nobody touched have no turn to name, so a rotation chore's
 *   shows without a person.
 */
export function choreOccurrences(input: CalendarInput): ChoreOccurrence[] {
	const from = addDays(input.today, -CALENDAR_LOOKBACK_DAYS);
	const to = addDays(input.today, CALENDAR_WINDOW_DAYS);
	const fixed = new Map(
		input.instances.map((i) => [key(i.choreId, i.periodStart), i]),
	);
	const rotationByChore = new Map(input.rotations.map((r) => [r.choreId, r]));

	const out: ChoreOccurrence[] = [];
	for (const chore of input.chores) {
		const periods = periodsBetween(chore, from, to);
		const rotation =
			chore.type === 'rotation' ? rotationByChore.get(chore.id) : undefined;

		// The member the next unfixed, unstarted period goes to.
		let projected: string | null = null;
		let projecting = false;
		if (rotation) {
			const eligible = rotation.members.filter((m) => m.eligible);
			const current = eligible.find(
				(m) => m.memberId === rotation.currentMemberId,
			);
			projected =
				(current ?? nextEligibleMember(rotation.members, null)?.member)
					?.memberId ?? null;
			projecting = projected !== null;
		}

		for (const period of periods) {
			const instance = fixed.get(key(chore.id, period.periodStart));
			let assigneeId: string | null;
			if (instance) {
				assigneeId = instance.assignedMemberId;
			} else if (chore.type === 'personal') {
				assigneeId = chore.assignedMemberId;
			} else if (
				projecting &&
				// Still open: a weekly chore whose due day has passed can be done
				// until the week ends, so this is the period the active turn is on.
				addDays(period.periodStart, chore.frequency === 'weekly' ? 7 : 1) >
					input.today
			) {
				assigneeId = projected;
				projected =
					(rotation && projected
						? nextEligibleMember(rotation.members, projected)?.member.memberId
						: null) ?? null;
				projecting = projected !== null;
			} else {
				assigneeId = null;
			}
			out.push({ chore, assigneeId, ...period });
		}
	}
	return out.sort(
		(a, b) =>
			a.date.localeCompare(b.date) ||
			(a.chore.dueTime ?? '').localeCompare(b.chore.dueTime ?? '') ||
			a.chore.title.localeCompare(b.chore.title),
	);
}

// --- iCalendar writing ---

/** Escapes a TEXT value (RFC 5545 section 3.3.11). */
export function escapeText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Folds a content line to at most 75 octets, continuing on lines that start
 * with a space (RFC 5545 section 3.1). Never splits a UTF-8 character.
 */
export function foldLine(line: string): string {
	const encoder = new TextEncoder();
	if (encoder.encode(line).length <= 75) return line;
	const parts: string[] = [];
	let current = '';
	let size = 0;
	// The first line holds 75 octets; continuation lines hold 74 plus the space.
	let limit = 75;
	for (const char of line) {
		const bytes = encoder.encode(char).length;
		if (size + bytes > limit) {
			parts.push(current);
			current = '';
			size = 0;
			limit = 74;
		}
		current += char;
		size += bytes;
	}
	parts.push(current);
	return parts.join('\r\n ');
}

const compact = (date: string) => date.replaceAll('-', '');

function utcStamp(at: Date): string {
	return `${at.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

/** The offset of `timeZone` from UTC at `instant`, in milliseconds. */
function offsetMs(timeZone: string, instant: number): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(new Date(instant));
	const get = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second'),
	);
	return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant a local date and `HH:MM[:SS]` time fall on in `timeZone`. Written
 * as UTC in the feed, so clients don't need a `VTIMEZONE` to place it. A time
 * skipped by a DST jump lands just after it.
 */
export function zonedTimeToUtc(
	date: string,
	time: string,
	timeZone: string,
): Date {
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = time.split(':').map(Number);
	const guess = Date.UTC(y, m - 1, d, hh, mm);
	// Second pass: the offset at the first answer can differ across a DST edge.
	const first = guess - offsetMs(timeZone, guess);
	return new Date(guess - offsetMs(timeZone, first));
}

function eventLines(
	o: ChoreOccurrence,
	input: CalendarInput,
	stamp: string,
): string[] {
	const assignee = o.assigneeId
		? (input.memberNames.get(o.assigneeId) ?? null)
		: null;
	const summary = assignee ? `${o.chore.title} — ${assignee}` : o.chore.title;

	const notes: string[] = [];
	if (assignee) notes.push(`Assigned to: ${assignee}`);
	else notes.push('Not assigned to anyone yet');
	if (o.chore.dueLabel) notes.push(`Due: ${o.chore.dueLabel}`);
	if (o.chore.description) notes.push(o.chore.description);

	const lines = [
		'BEGIN:VEVENT',
		`UID:${o.chore.id}-${o.periodStart}@chores.salabridge`,
		`DTSTAMP:${stamp}`,
		`SUMMARY:${escapeText(summary)}`,
		`DESCRIPTION:${escapeText(notes.join('\n'))}`,
	];
	if (o.chore.dueTime) {
		const start = zonedTimeToUtc(o.date, o.chore.dueTime, input.timeZone);
		const end = new Date(start.getTime() + TIMED_EVENT_MINUTES * 60_000);
		lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
	} else {
		lines.push(
			`DTSTART;VALUE=DATE:${compact(o.date)}`,
			`DTEND;VALUE=DATE:${compact(addDays(o.date, o.days))}`,
			// An all-day entry shouldn't block the person's day out as busy.
			'TRANSP:TRANSPARENT',
		);
	}
	lines.push('END:VEVENT');
	return lines;
}

/** The feed as an iCalendar document (CRLF line endings, folded lines). */
export function buildCalendar(input: CalendarInput): string {
	const stamp = utcStamp(input.now);
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Salabridge//Chores//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(`${input.householdName} chores`)}`,
		`X-WR-TIMEZONE:${input.timeZone}`,
		// Hints for clients that honour them; Google ignores them and polls on
		// its own schedule (often every few hours).
		'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
		'X-PUBLISHED-TTL:PT1H',
		...choreOccurrences(input).flatMap((o) => eventLines(o, input, stamp)),
		'END:VCALENDAR',
	];
	return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
