import { householdMemberPins, householdMembers, households } from '@chore/db';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { type CreateChoreInput, createInputError } from '../chore-creator.ts';
import {
	type HouseholdInput,
	type KidInput,
	MAX_KIDS,
	type ParentInput,
	resolveSetupStatus,
	type SetupMembership,
	type SetupProgress,
	type SetupStatus,
	type StarterChore,
} from '../setup.ts';
import { db } from './drizzle.ts';
import { insertManagedKid } from './kids.ts';

// First-run setup writes (SB-56). As with the other web-side modules, the web
// app talks to Postgres as the table owner, so RLS does not apply here: every
// query is scoped by the household the *server* resolved for the signed-in
// user (`loadSetupStatus`), never by an id from the client. The database
// still enforces the same shape (`household_members_*_check`, the one
// unfinished household per creator index).

/** A problem with what the parent sent, worded for the form. */
export class SetupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SetupError';
	}
}

type SetupHousehold = NonNullable<SetupStatus['household']>;

/** Loads the user's setup state in one query. Used by `hooks.server.ts`. */
export async function loadSetupStatus(userId: string): Promise<SetupStatus> {
	const rows = await db
		.select({
			householdId: householdMembers.householdId,
			memberId: householdMembers.id,
			role: householdMembers.role,
			householdCreatedBy: households.createdBy,
			householdName: households.name,
			householdTimezone: households.timezone,
			setupCompletedAt: households.setupCompletedAt,
		})
		.from(householdMembers)
		.innerJoin(households, eq(households.id, householdMembers.householdId))
		.where(eq(householdMembers.userId, userId));
	return resolveSetupStatus(userId, rows satisfies SetupMembership[]);
}

export interface SetupKid {
	id: string;
	displayName: string;
	birthYear: number | null;
	weeklyGoalPoints: number;
	avatarColor: string | null;
}

export interface SetupData {
	progress: SetupProgress;
	household: { name: string; timezone: string } | null;
	parent: {
		displayName: string;
		avatarColor: string | null;
		avatarInitial: string | null;
	} | null;
	kids: SetupKid[];
}

/** What step 1 to 5 have saved so far, for the setup page. */
export async function loadSetupData(status: SetupStatus): Promise<SetupData> {
	const household = status.household;
	if (!household) {
		return {
			progress: {
				hasHousehold: false,
				parentSaved: false,
				kidCount: 0,
				hasPin: false,
			},
			household: null,
			parent: null,
			kids: [],
		};
	}

	const [[parent], kids, [pin]] = await Promise.all([
		db
			.select({
				displayName: householdMembers.displayName,
				avatarColor: householdMembers.avatarColor,
				avatarInitial: householdMembers.avatarInitial,
			})
			.from(householdMembers)
			.where(eq(householdMembers.id, household.memberId)),
		db
			.select({
				id: householdMembers.id,
				displayName: householdMembers.displayName,
				birthYear: householdMembers.birthYear,
				weeklyGoalPoints: householdMembers.weeklyGoalPoints,
				avatarColor: householdMembers.avatarColor,
			})
			.from(householdMembers)
			.where(
				and(
					eq(householdMembers.householdId, household.id),
					eq(householdMembers.role, 'kid'),
					isNull(householdMembers.userId),
				),
			)
			.orderBy(asc(householdMembers.joinedAt), asc(householdMembers.id)),
		db
			.select({ memberId: householdMemberPins.memberId })
			.from(householdMemberPins)
			.where(eq(householdMemberPins.memberId, household.memberId)),
	]);

	return {
		progress: {
			hasHousehold: true,
			// The owner row the trigger creates has no avatar colour; step 2 sets one.
			parentSaved: parent?.avatarColor != null,
			kidCount: kids.length,
			hasPin: pin !== undefined,
		},
		household: { name: household.name, timezone: household.timezone },
		parent: parent ?? null,
		kids,
	};
}

function isUniqueViolation(e: unknown): boolean {
	const code = (e as { code?: string; cause?: { code?: string } } | null)?.code;
	const causeCode = (e as { cause?: { code?: string } } | null)?.cause?.code;
	return code === '23505' || causeCode === '23505';
}

/**
 * Step 1. Creates the household (the `households_add_creator` trigger makes
 * the user its owner), or renames the one already being set up. A second
 * submit never creates a second household: the unique index allows one
 * unfinished household per creator, and a lost race falls back to the update.
 */
export async function saveHousehold(
	userId: string,
	status: SetupStatus,
	input: HouseholdInput,
): Promise<void> {
	if (!status.needsSetup) throw new SetupError('Setup is already finished.');
	if (!status.household) {
		try {
			await db.insert(households).values({
				name: input.name,
				timezone: input.timezone,
				createdBy: userId,
			});
			return;
		} catch (e) {
			if (!isUniqueViolation(e)) throw e;
		}
		// Someone (a second tab) created it first: update that one instead.
		const current = await loadSetupStatus(userId);
		if (!current.household)
			throw new SetupError('Could not create the household.');
		status = current;
	}
	const household = status.household as SetupHousehold;
	await db
		.update(households)
		.set({ name: input.name, timezone: input.timezone })
		.where(
			and(
				eq(households.id, household.id),
				eq(households.createdBy, userId),
				isNull(households.setupCompletedAt),
			),
		);
}

function requireHousehold(status: SetupStatus): SetupHousehold {
	if (!status.needsSetup) throw new SetupError('Setup is already finished.');
	if (!status.household) throw new SetupError('Start with your household.');
	return status.household;
}

// `status` was read before this request's write, so another tab may have
// finished setup since. Each write below re-checks it in the same statement.
const stillInSetup = (householdId: string) =>
	sql`exists (select 1 from households h where h.id = ${householdId} and h.setup_completed_at is null)`;

/** Step 2. The parent's own display name and avatar. */
export async function saveParent(
	status: SetupStatus,
	input: ParentInput,
): Promise<void> {
	const household = requireHousehold(status);
	await db
		.update(householdMembers)
		.set({
			displayName: input.displayName,
			avatarColor: input.avatarColor,
			avatarInitial: input.avatarInitial,
		})
		.where(
			and(
				eq(householdMembers.id, household.memberId),
				stillInSetup(household.id),
			),
		);
}

/**
 * Step 3. Adds a managed kid (no login), up to `MAX_KIDS`; see kids.ts for how
 * the cap holds under a double submit.
 */
export async function addKid(
	status: SetupStatus,
	input: KidInput,
): Promise<void> {
	const household = requireHousehold(status);
	if (!(await insertManagedKid(household.id, input, 'during-setup'))) {
		throw new SetupError(`You can add up to ${MAX_KIDS} kids during setup.`);
	}
}

/** Removes a kid added during setup. Only managed kids of this household. */
export async function removeKid(
	status: SetupStatus,
	kidId: unknown,
): Promise<void> {
	const household = requireHousehold(status);
	if (typeof kidId !== 'string')
		throw new SetupError('Choose a kid to remove.');
	// Once setup is finished the kid may have chores and points; removing them
	// then belongs to the profiles screen, not a stale setup tab.
	await db
		.delete(householdMembers)
		.where(
			and(
				eq(householdMembers.id, kidId),
				eq(householdMembers.householdId, household.id),
				eq(householdMembers.role, 'kid'),
				isNull(householdMembers.userId),
				stillInSetup(household.id),
			),
		);
}

/**
 * Step 6. Optionally creates the picked starter chores (a personal chore per
 * chosen kid) and marks setup finished, in one statement so a failure leaves
 * setup open to retry and a second submit creates nothing. Refuses until the household, parent, a kid and the PIN
 * are saved.
 */
export async function finishSetup(
	userId: string,
	status: SetupStatus,
	picked: StarterChore[],
	assigneeIds: string[],
): Promise<void> {
	const household = requireHousehold(status);
	const data = await loadSetupData(status);
	const { progress } = data;
	if (!progress.parentSaved)
		throw new SetupError('Finish the "You" step first.');
	if (progress.kidCount < 1)
		throw new SetupError('Add at least one kid first.');
	if (!progress.hasPin) throw new SetupError('Set your parent PIN first.');

	const kids = new Set(data.kids.map((k) => k.id));
	const assignees = assigneeIds.length
		? assigneeIds.filter((id, i, all) => all.indexOf(id) === i)
		: [...kids];
	if (assignees.some((id) => !kids.has(id))) {
		throw new SetupError('Choose kids from your household.');
	}
	if (picked.length > 0 && assignees.length === 0) {
		throw new SetupError('Choose who gets the chores.');
	}

	const values = picked.flatMap((chore) =>
		assignees.map((assigneeId) => {
			const input: CreateChoreInput = {
				title: chore.title,
				note: null,
				kind: 'personal',
				frequency: chore.frequency,
				points: chore.points,
				assigneeId,
				stages: [],
			};
			const problem = createInputError(input);
			if (problem) throw new SetupError(problem);
			return sql`(${chore.title}, ${chore.points}::integer, ${chore.frequency}::chore_frequency, ${assigneeId}::uuid)`;
		}),
	);
	if (values.length === 0) {
		await db
			.update(households)
			.set({ setupCompletedAt: sql`now()` })
			.where(
				and(
					eq(households.id, household.id),
					eq(households.createdBy, userId),
					isNull(households.setupCompletedAt),
				),
			);
		return;
	}
	// One statement: the update claims the unfinished household, and the chores
	// are only inserted by the request that claimed it. A concurrent submit
	// waits on the row lock, then matches nothing and inserts nothing.
	await db.execute(sql`
		with done as (
			update households set setup_completed_at = now()
			where id = ${household.id}
				and created_by = ${userId}
				and setup_completed_at is null
			returning id
		)
		insert into chores (household_id, title, type, points, frequency, assigned_member_id, created_by)
		select done.id, v.title, 'personal', v.points, v.frequency, v.assignee, ${userId}::uuid
		from done
		cross join (values ${sql.join(values, sql`, `)}) as v(title, points, frequency, assignee)`);
}
