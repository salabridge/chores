import {
	choreInstances,
	choreRotationMembers,
	choreRotations,
	chores,
	householdCalendarTokens,
	householdMembers,
	households,
} from '@chore/db';
import { createCalendarToken, isCalendarToken } from '@chore/db/calendar-token';
import { addDays, localDate } from '@chore/db/recurrence';
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import {
	buildCalendar,
	CALENDAR_LOOKBACK_DAYS,
	CALENDAR_WINDOW_DAYS,
	type CalendarChore,
} from '../calendar.ts';
import { db } from './drizzle.ts';

// The household calendar feed (SB-101). As with the other web-side modules, the
// web app talks to Postgres as the table owner, so RLS doesn't apply: the
// parent-facing functions are scoped by the household of the caller's own
// profile (the remote functions that call them require a parent), and the
// public feed is scoped by the token alone.

/** Where the feed lives, relative to the site. The token is the whole credential. */
export const calendarPath = (token: string) => `/calendar/${token}.ics`;

/**
 * The household's token, made on first use. One statement, so two parents
 * opening Account at once can't each make a different one.
 */
export async function getOrCreateCalendarToken(
	householdId: string,
	userId: string,
): Promise<string> {
	await db
		.insert(householdCalendarTokens)
		.values({
			householdId,
			token: createCalendarToken(),
			createdBy: userId,
		})
		.onConflictDoNothing({ target: householdCalendarTokens.householdId });
	const [row] = await db
		.select({ token: householdCalendarTokens.token })
		.from(householdCalendarTokens)
		.where(eq(householdCalendarTokens.householdId, householdId));
	// The insert above guarantees a row unless the household was just deleted.
	if (!row) throw new Error('Calendar token is missing');
	return row.token;
}

/** Replaces the token, which stops the old link working. Returns the new one. */
export async function regenerateCalendarToken(
	householdId: string,
	userId: string,
): Promise<string> {
	const token = createCalendarToken();
	await db
		.insert(householdCalendarTokens)
		.values({ householdId, token, createdBy: userId })
		.onConflictDoUpdate({
			target: householdCalendarTokens.householdId,
			set: { token, createdBy: userId, rotatedAt: new Date() },
		});
	return token;
}

/**
 * The feed for a calendar token, or null when the token doesn't belong to a
 * household (wrong shape, never issued, or since regenerated).
 */
export async function loadCalendarFeed(
	token: string,
	now: Date = new Date(),
): Promise<string | null> {
	if (!isCalendarToken(token)) return null;
	const [owner] = await db
		.select({
			householdId: householdCalendarTokens.householdId,
			name: households.name,
			timeZone: households.timezone,
		})
		.from(householdCalendarTokens)
		.innerJoin(
			households,
			eq(households.id, householdCalendarTokens.householdId),
		)
		.where(eq(householdCalendarTokens.token, token));
	if (!owner) return null;

	const today = localDate(owner.timeZone, now);
	const { householdId } = owner;

	const [choreRows, members, rotationRows, loopRows] = await Promise.all([
		db
			.select({
				id: chores.id,
				title: chores.title,
				description: chores.description,
				type: chores.type,
				frequency: chores.frequency,
				dueTime: chores.dueTime,
				dueLabel: chores.dueLabel,
				dueWeekday: chores.dueWeekday,
				assignedMemberId: chores.assignedMemberId,
				updatedAt: chores.updatedAt,
			})
			.from(chores)
			.where(
				and(eq(chores.householdId, householdId), isNull(chores.archivedAt)),
			),
		// Names only, so a removed member's past chores still show who had them.
		db
			.select({ id: householdMembers.id, name: householdMembers.displayName })
			.from(householdMembers)
			.where(eq(householdMembers.householdId, householdId)),
		db
			.select({
				choreId: choreRotations.choreId,
				currentMemberId: choreRotations.currentMemberId,
			})
			.from(choreRotations)
			.where(eq(choreRotations.householdId, householdId)),
		db
			.select({
				choreId: choreRotationMembers.choreId,
				memberId: choreRotationMembers.memberId,
				position: choreRotationMembers.position,
				eligible: choreRotationMembers.eligible,
			})
			.from(choreRotationMembers)
			.where(eq(choreRotationMembers.householdId, householdId)),
	]);

	const feedChores: CalendarChore[] = choreRows.map((c) => ({
		...c,
		// `chore_type` has these two values; the cast keeps the pure module free
		// of the database enum.
		type: c.type as CalendarChore['type'],
	}));
	const choreIds = feedChores.map((c) => c.id);
	// A weekly chore's Monday can be up to six days before the window starts.
	const instances = choreIds.length
		? await db
				.select({
					choreId: choreInstances.choreId,
					periodStart: choreInstances.periodStart,
					assignedMemberId: choreInstances.assignedMemberId,
				})
				.from(choreInstances)
				.where(
					and(
						eq(choreInstances.householdId, householdId),
						inArray(choreInstances.choreId, choreIds),
						gte(
							choreInstances.periodStart,
							addDays(today, -CALENDAR_LOOKBACK_DAYS - 7),
						),
						lte(
							choreInstances.periodStart,
							addDays(today, CALENDAR_WINDOW_DAYS),
						),
					),
				)
		: [];

	return buildCalendar({
		householdName: owner.name,
		timeZone: owner.timeZone,
		today,
		now,
		chores: feedChores,
		rotations: rotationRows.map((r) => ({
			choreId: r.choreId,
			currentMemberId: r.currentMemberId,
			members: loopRows.filter((m) => m.choreId === r.choreId),
		})),
		instances,
		memberNames: new Map(members.map((m) => [m.id, m.name])),
	});
}
