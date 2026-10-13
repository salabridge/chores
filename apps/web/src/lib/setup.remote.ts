import { error, invalid, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { getSetupStatus, resetProfileCache } from '#lib/server/profiles.js';
import {
	addKid,
	finishSetup,
	removeKid,
	SetupError,
	saveHousehold,
	saveParent,
} from '#lib/server/setup.js';
import { form } from '$app/server';
import {
	parseHouseholdInput,
	parseKidInput,
	parseParentInput,
	pickStarterChores,
} from './setup.ts';

// Remote functions for the first-run setup flow (SB-56). Each one checks on
// the server that this user still needs setup and takes the household from
// `getSetupStatus()`, never from the request, so a client can't write to
// someone else's household or reopen a finished setup.

async function setupContext() {
	const user = requireUser();
	const status = await getSetupStatus();
	if (!status?.needsSetup) error(403, 'Setup is already finished.');
	return { user, status };
}

/** Runs a write, turning a `SetupError` into a form message. */
async function write(run: () => Promise<void>) {
	try {
		await run();
	} catch (e) {
		if (e instanceof SetupError) invalid(e.message);
		throw e;
	}
	resetProfileCache();
	return { saved: true };
}

/** Step 1: creates the household, or updates the one being set up. */
export const saveHouseholdStep = form(
	'unchecked',
	async (data: { name: string; timezone: string }) => {
		const { user, status } = await setupContext();
		const parsed = parseHouseholdInput(data);
		if (!parsed.ok) invalid(parsed.message);
		return write(() => saveHousehold(user.id, status, parsed.value));
	},
);

/** Step 2: the parent's own name and avatar. */
export const saveParentStep = form(
	'unchecked',
	async (data: {
		displayName: string;
		avatarColor: string;
		avatarInitial?: string;
	}) => {
		const { status } = await setupContext();
		const parsed = parseParentInput(data);
		if (!parsed.ok) invalid(parsed.message);
		return write(() => saveParent(status, parsed.value));
	},
);

/** Step 3: adds one managed kid. */
export const addKidStep = form(
	'unchecked',
	async (data: {
		displayName: string;
		birthYear?: string;
		avatarColor: string;
		weeklyGoalPoints?: string;
	}) => {
		const { status } = await setupContext();
		const parsed = parseKidInput(data);
		if (!parsed.ok) invalid(parsed.message);
		return write(() => addKid(status, parsed.value));
	},
);

/** Step 3: removes a kid added earlier in setup. */
export const removeKidStep = form('unchecked', async (data: { id: string }) => {
	const { status } = await setupContext();
	return write(() => removeKid(status, data.id));
});

/**
 * Step 5 and 6: optionally creates starter chores, then finishes setup and
 * lands on `/today`. Skipping sends no chores.
 */
export const finishSetupStep = form(
	'unchecked',
	async (data: {
		chores?: string[];
		assignees?: string[];
		/** Set by the Skip button: finish without creating chores. */
		skip?: string;
	}) => {
		const { user, status } = await setupContext();
		const picked = data.skip ? [] : pickStarterChores(data.chores);
		const assignees = Array.isArray(data.assignees)
			? data.assignees.map(String)
			: [];
		await write(() => finishSetup(user.id, status, picked, assignees));
		redirect(303, '/today');
	},
);
