// First-run setup for a new parent (SB-56), as plain data shared by the setup
// screens, the remote functions and the tests. No server imports: this is
// bundled into the client, and the same validation runs again on the server.
// The limits mirror the database checks (`household_members_*_check`,
// `households.timezone`).

import { isValidTimeZone } from '@chore/db/recurrence';
import type { Frequency } from './chore-creator.ts';

export const SETUP_STEPS = [
	'household',
	'parent',
	'kids',
	'pin',
	'chores',
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export const STEP_LABELS: Record<SetupStep, string> = {
	household: 'Household',
	parent: 'You',
	kids: 'Kids',
	pin: 'Parent PIN',
	chores: 'Starter chores',
};

export const MAX_HOUSEHOLD_NAME = 80;
/** `household_members_display_name_check`: 1 to 50 characters after trimming. */
export const MAX_DISPLAY_NAME = 50;
export const MIN_BIRTH_YEAR = 1900;
/**
 * `pattern` for birth year inputs. Pass it as `pattern={BIRTH_YEAR_PATTERN}`:
 * written inline in a Svelte attribute, `{4}` is an expression and the
 * pattern renders as `[0-9]4`.
 */
export const BIRTH_YEAR_PATTERN = '[0-9]{4}';
export const DEFAULT_WEEKLY_GOAL = 200;
export const MAX_WEEKLY_GOAL = 10_000;
export const MAX_KIDS = 12;

import { isAvatarColor, normalizeAvatarColor } from './avatar-color.ts';

export { AVATAR_PRESETS as AVATAR_COLORS } from './avatar-color.ts';
export { isAvatarColor };
/** A preset key or a custom `#rrggbb`. */
export type AvatarColor = string;

/** What the database knows about a user's setup, boiled down to one row each. */
export interface SetupMembership {
	householdId: string;
	memberId: string;
	role: 'owner' | 'parent' | 'kid';
	/** `households.created_by`. */
	householdCreatedBy: string;
	householdName: string;
	householdTimezone: string;
	setupCompletedAt: Date | null;
}

export interface SetupStatus {
	needsSetup: boolean;
	/** The unfinished household being set up, or null before step 1. */
	household: {
		id: string;
		name: string;
		timezone: string;
		/** The creator's own `household_members.id`. */
		memberId: string;
	} | null;
}

/**
 * Decides whether a signed-in user has to go through setup.
 *
 * - Not in any household: yes (step 1 creates it).
 * - In a household whose setup is finished (including every household that
 *   existed before the flow): no. That also covers someone invited into one.
 * - Owner and creator of a household that is not finished: yes, and they
 *   resume it.
 * - Anything else (invited into an unfinished household): no. Invited users
 *   never see setup.
 */
export function resolveSetupStatus(
	userId: string,
	memberships: SetupMembership[],
): SetupStatus {
	if (memberships.length === 0) return { needsSetup: true, household: null };
	if (memberships.some((m) => m.setupCompletedAt !== null)) {
		return { needsSetup: false, household: null };
	}
	const own = memberships.find(
		(m) => m.role === 'owner' && m.householdCreatedBy === userId,
	);
	if (!own) return { needsSetup: false, household: null };
	return {
		needsSetup: true,
		household: {
			id: own.householdId,
			name: own.householdName,
			timezone: own.householdTimezone,
			memberId: own.memberId,
		},
	};
}

/** The setup page's route id. It lives under `(protected)` so it needs a session. */
export const SETUP_ROUTE_ID = '/(protected)/setup';

/**
 * Where a signed-in user is sent for this route because of their setup state,
 * or null to carry on. People who need setup are sent to `/setup` from `/` and
 * every `(protected)` route; people who don't are sent away from `/setup`.
 * Remote functions have no route id, so they check this on their own.
 */
export function setupRedirect(
	routeId: string | null | undefined,
	needsSetup: boolean,
): string | null {
	if (routeId === SETUP_ROUTE_ID) return needsSetup ? null : '/today';
	if (routeId === '/' || routeId?.startsWith('/(protected)')) {
		return needsSetup ? '/setup' : null;
	}
	return null;
}

/** What has been saved so far, from rows the server loaded. */
export interface SetupProgress {
	hasHousehold: boolean;
	/** The parent chose an avatar in step 2 (the owner row starts without one). */
	parentSaved: boolean;
	kidCount: number;
	hasPin: boolean;
}

/** The first unfinished step. Starter chores are optional, so they come last. */
export function currentStep(progress: SetupProgress): SetupStep {
	if (!progress.hasHousehold) return 'household';
	if (!progress.parentSaved) return 'parent';
	if (progress.kidCount < 1) return 'kids';
	if (!progress.hasPin) return 'pin';
	return 'chores';
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const fail = (message: string): { ok: false; message: string } => ({
	ok: false,
	message,
});

function parseName(raw: unknown, label: string, max: number): Parsed<string> {
	const name = String(raw ?? '').trim();
	if (name.length === 0) return fail(`Enter ${label}.`);
	if (name.length > max) return fail(`Keep ${label} to ${max} characters.`);
	return { ok: true, value: name };
}

export interface HouseholdInput {
	name: string;
	timezone: string;
}

export function parseHouseholdInput(data: {
	name?: unknown;
	timezone?: unknown;
}): Parsed<HouseholdInput> {
	const name = parseName(data.name, 'a household name', MAX_HOUSEHOLD_NAME);
	if (!name.ok) return name;
	const timezone = String(data.timezone ?? '').trim();
	if (
		timezone.length < 1 ||
		timezone.length > 64 ||
		!isValidTimeZone(timezone)
	) {
		return fail('Choose a valid time zone.');
	}
	return { ok: true, value: { name: name.value, timezone } };
}

export interface ParentInput {
	displayName: string;
	avatarColor: AvatarColor;
	/** One or two characters, or null to use the name's first letter. */
	avatarInitial: string | null;
}

function parseInitial(raw: unknown): Parsed<string | null> {
	const initial = String(raw ?? '').trim();
	if (initial.length === 0) return { ok: true, value: null };
	if ([...initial].length > 2) {
		return fail('Use one or two letters for the initial.');
	}
	return { ok: true, value: initial };
}

export function parseParentInput(data: {
	displayName?: unknown;
	avatarColor?: unknown;
	avatarInitial?: unknown;
}): Parsed<ParentInput> {
	const name = parseName(data.displayName, 'your name', MAX_DISPLAY_NAME);
	if (!name.ok) return name;
	if (!isAvatarColor(data.avatarColor)) return fail('Choose an avatar colour.');
	const initial = parseInitial(data.avatarInitial);
	if (!initial.ok) return initial;
	return {
		ok: true,
		value: {
			displayName: name.value,
			avatarColor: normalizeAvatarColor(data.avatarColor),
			avatarInitial: initial.value,
		},
	};
}

export interface KidInput extends ParentInput {
	birthYear: number | null;
	weeklyGoalPoints: number;
}

export function parseKidInput(
	data: {
		displayName?: unknown;
		birthYear?: unknown;
		avatarColor?: unknown;
		avatarInitial?: unknown;
		weeklyGoalPoints?: unknown;
	},
	currentYear = new Date().getFullYear(),
): Parsed<KidInput> {
	const base = parseParentInput({
		displayName: data.displayName,
		avatarColor: data.avatarColor,
		avatarInitial: data.avatarInitial,
	});
	if (!base.ok) {
		return base.message === 'Enter your name.'
			? fail("Enter your kid's name.")
			: base;
	}

	let birthYear: number | null = null;
	const rawYear = String(data.birthYear ?? '').trim();
	if (rawYear !== '') {
		birthYear = Number(rawYear);
		if (
			!Number.isInteger(birthYear) ||
			birthYear < MIN_BIRTH_YEAR ||
			birthYear > currentYear
		) {
			return fail(
				`Enter a birth year between ${MIN_BIRTH_YEAR} and ${currentYear}.`,
			);
		}
	}

	const rawGoal = String(data.weeklyGoalPoints ?? '').trim();
	const goal = rawGoal === '' ? DEFAULT_WEEKLY_GOAL : Number(rawGoal);
	if (!Number.isInteger(goal) || goal < 0 || goal > MAX_WEEKLY_GOAL) {
		return fail(
			`Enter a weekly points goal from 0 to ${MAX_WEEKLY_GOAL.toLocaleString('en-US')}.`,
		);
	}
	return {
		ok: true,
		value: { ...base.value, birthYear, weeklyGoalPoints: goal },
	};
}

/** Common chores offered on the last step, so `/today` isn't empty on day one. */
export interface StarterChore {
	id: string;
	title: string;
	points: number;
	frequency: Frequency;
}

export const STARTER_CHORES: readonly StarterChore[] = [
	{ id: 'make-bed', title: 'Make your bed', points: 5, frequency: 'daily' },
	{ id: 'set-table', title: 'Set the table', points: 5, frequency: 'daily' },
	{ id: 'feed-pets', title: 'Feed the pets', points: 5, frequency: 'daily' },
	{ id: 'tidy-room', title: 'Tidy your room', points: 10, frequency: 'daily' },
	{
		id: 'dishes',
		title: 'Help with the dishes',
		points: 10,
		frequency: 'daily',
	},
	{
		id: 'trash',
		title: 'Take out the trash',
		points: 10,
		frequency: 'weekly',
	},
	{
		id: 'laundry',
		title: 'Put away laundry',
		points: 10,
		frequency: 'weekly',
	},
	{ id: 'vacuum', title: 'Vacuum a room', points: 15, frequency: 'weekends' },
];

/** Preset ids from a form, in preset order, dropping duplicates and unknown ids. */
export function pickStarterChores(ids: unknown): StarterChore[] {
	const wanted = new Set(Array.isArray(ids) ? ids.map(String) : []);
	return STARTER_CHORES.filter((c) => wanted.has(c.id));
}
