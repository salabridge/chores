import { createHash, randomBytes } from 'node:crypto';
import { deviceProfiles, householdMembers } from '@chore/db';
import type { Cookies } from '@sveltejs/kit';
import { and, asc, eq, or } from 'drizzle-orm';
import { dev } from '$app/env';
import { getRequestEvent } from '$app/server';
import { db } from './drizzle.ts';
import {
	type MemberSummary,
	type ProfileState,
	resolveProfile,
} from './profile-state.ts';

// Where the active profile lives (SB-51)
//
// The device cookie holds only a random device id. Which profile that device
// is acting as is a row in `device_profiles` on the server, so the browser
// never sends (or can forge) a member id. Every request re-checks that the
// signed-in user is a parent in the same household as the remembered kid.
//
// The row is keyed by device + user and outlives the session. After a session
// expiry or a restart the parent signs in again and the device comes straight
// back to the same kid, with no prompt. If only the device cookie is cleared,
// the row is found again through the session id and the cookie is re-issued,
// so deleting a cookie is not a way out of a kid profile.

const DEVICE_COOKIE = 'device-id';
// Browsers cap cookie lifetimes (400 days in Chrome); ask for the maximum.
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

const hashDevice = (deviceId: string) =>
	createHash('sha256').update(deviceId).digest('hex');

function setDeviceCookie(cookies: Cookies, deviceId: string) {
	cookies.set(DEVICE_COOKIE, deviceId, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: DEVICE_COOKIE_MAX_AGE,
	});
}

const memberColumns = {
	id: householdMembers.id,
	householdId: householdMembers.householdId,
	userId: householdMembers.userId,
	role: householdMembers.role,
	displayName: householdMembers.displayName,
	avatarColor: householdMembers.avatarColor,
	avatarInitial: householdMembers.avatarInitial,
};

/** The signed-in user's own member rows (one per household). */
async function loadMemberships(userId: string): Promise<MemberSummary[]> {
	return db
		.select(memberColumns)
		.from(householdMembers)
		.where(eq(householdMembers.userId, userId))
		.orderBy(asc(householdMembers.joinedAt));
}

export async function getMember(id: string): Promise<MemberSummary | null> {
	const [member] = await db
		.select(memberColumns)
		.from(householdMembers)
		.where(eq(householdMembers.id, id));
	return member ?? null;
}

/** Managed kids (no login) in a household, for the profile picker. */
export async function listManagedKids(
	householdId: string,
): Promise<MemberSummary[]> {
	return db
		.select(memberColumns)
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.householdId, householdId),
				eq(householdMembers.role, 'kid'),
			),
		)
		.orderBy(asc(householdMembers.displayName))
		.then((rows) => rows.filter((m) => m.userId === null));
}

async function findDeviceProfile(
	userId: string,
	deviceHash: string | null,
	sessionId: string | null,
) {
	const matches = [
		deviceHash ? eq(deviceProfiles.deviceHash, deviceHash) : undefined,
		sessionId ? eq(deviceProfiles.sessionId, sessionId) : undefined,
	].filter((m) => m !== undefined);
	if (matches.length === 0) return null;

	const rows = await db
		.select({
			deviceHash: deviceProfiles.deviceHash,
			sessionId: deviceProfiles.sessionId,
			activeMemberId: deviceProfiles.activeMemberId,
			activeMember: memberColumns,
		})
		.from(deviceProfiles)
		.leftJoin(
			householdMembers,
			eq(deviceProfiles.activeMemberId, householdMembers.id),
		)
		.where(and(eq(deviceProfiles.userId, userId), or(...matches)));
	// The device's own row wins over one found only through the session.
	return rows.find((row) => row.deviceHash === deviceHash) ?? rows[0] ?? null;
}

type RequestEvent = ReturnType<typeof getRequestEvent>;

const cache = new WeakMap<
	RequestEvent['locals'],
	Promise<ProfileState | null>
>();

/**
 * Who this request is acting as, or null when signed out or not in a
 * household yet. Resolved once per request. Throws if the database can't be
 * reached, so callers that gate on it fail closed.
 */
export function getProfileState(): Promise<ProfileState | null> {
	const event = getRequestEvent();
	let state = cache.get(event.locals);
	if (!state) {
		state = loadProfileState(event);
		cache.set(event.locals, state);
	}
	return state;
}

async function loadProfileState({
	locals,
	cookies,
}: RequestEvent): Promise<ProfileState | null> {
	const { user, session } = locals;
	if (!user) return null;

	const deviceId = cookies.get(DEVICE_COOKIE);
	const deviceHash = deviceId ? hashDevice(deviceId) : null;
	const sessionId = session?.id ?? null;

	const [memberships, device] = await Promise.all([
		loadMemberships(user.id),
		findDeviceProfile(user.id, deviceHash, sessionId),
	]);

	const state = resolveProfile(
		memberships,
		device?.activeMemberId ? (device.activeMember ?? null) : null,
	);

	if (
		device &&
		(device.deviceHash !== deviceHash || device.sessionId !== sessionId)
	) {
		// Found through the session after the cookie went missing, or the user
		// signed in again: re-bind the row and cookie to this device and session.
		try {
			const nextId = deviceId ?? randomBytes(32).toString('base64url');
			await db
				.update(deviceProfiles)
				.set({ deviceHash: hashDevice(nextId), sessionId })
				.where(
					and(
						eq(deviceProfiles.userId, user.id),
						eq(deviceProfiles.deviceHash, device.deviceHash),
					),
				);
			if (!deviceId) setDeviceCookie(cookies, nextId);
		} catch (error) {
			// Bookkeeping only; the profile above is already resolved.
			console.error('Could not refresh the device profile', error);
		}
	}
	return state;
}

/**
 * Makes `memberId` the active kid profile for this device, or the user's own
 * view when null. The caller must already have checked, from server-loaded
 * rows, that the signed-in user may open that member (`canOpenKidProfile`).
 */
export async function setActiveMember(memberId: string | null) {
	const event = getRequestEvent();
	const { user, session } = event.locals;
	if (!user) throw new Error('setActiveMember needs a signed-in user');

	let deviceId = event.cookies.get(DEVICE_COOKIE);
	if (!deviceId) {
		deviceId = randomBytes(32).toString('base64url');
		setDeviceCookie(event.cookies, deviceId);
	}
	const values = {
		deviceHash: hashDevice(deviceId),
		userId: user.id,
		activeMemberId: memberId,
		sessionId: session?.id ?? null,
	};
	await db
		.insert(deviceProfiles)
		.values(values)
		.onConflictDoUpdate({
			target: [deviceProfiles.deviceHash, deviceProfiles.userId],
			set: {
				activeMemberId: values.activeMemberId,
				sessionId: values.sessionId,
			},
		});
	cache.delete(event.locals);
}
