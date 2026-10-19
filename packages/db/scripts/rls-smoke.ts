/**
 * End-to-end check of the FKs, the RLS policies, and the member/role helpers,
 * using real Neon Auth sessions (not the owner role). Run against a dev branch
 * only:
 *
 *   pnpm --filter @chore/db test:rls
 *
 * Needs DATABASE_URL (owner, for setup/cleanup), DATABASE_AUTHENTICATED_URL,
 * and NEON_AUTH_URL in packages/db/.env. It signs up four throwaway users,
 * marks them verified with the owner connection (the branch requires email
 * verification), fetches a JWT for each, exercises the policies through
 * withAuth(), and deletes everything it created at the end.
 *
 * Cast: Alice creates a household (owner) and a managed kid, Mia, with no
 * login. She invites Bob as a parent and Carol as a kid; both accept. They
 * set up chores with stages, and Carol works through today's instance. They
 * take turns on a rotation chore. Carol and Mia do each other's chores as
 * favours, which wait for the owner's (or a parent's) OK (SB-74, SB-79). Dave
 * signs up and stays out until he moves his own household into Alice's on an
 * invite (SB-76).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { user } from '../schema/auth-schema.ts';
import {
	choreCompletions,
	choreInstances,
	choreReminders,
	choreRotationMembers,
	choreRotations,
	choreSkips,
	choreStageProgress,
	choreStages,
	chores,
	deviceProfiles,
	householdInvites,
	householdMemberPins,
	householdMembers,
	households,
	pointsLedger,
	rewardClaims,
	rewards,
	userPreferences,
} from '../schema/index.ts';
import {
	acceptHouseholdInvite,
	advanceRotation,
	ChoreDoerNotInHouseholdError,
	ChoreStagesIncompleteError,
	canActAsMember,
	completeChore,
	completeChoreStage,
	createAuthenticatedDb,
	createInviteToken,
	currentMemberId,
	decideFavour,
	escalateFavour,
	FavourDecidedByParentError,
	FavourEscalatedError,
	getRotationTurns,
	isHouseholdParent,
	memberPointsBalance,
	mergeHouseholdViaInvite,
	NotAFavourError,
	NotHouseholdParentError,
	reopenCompletion,
	requireHouseholdParent,
	StageLockedError,
	StaleRotationTurnError,
	weeklyPointsProgress,
} from '../src/authenticated-db.ts';
import { claimFailure, insertRewardClaim } from '../src/claim-reward.ts';
import { addDays, chorePeriodStart, localDate } from '../src/recurrence.ts';

const { DATABASE_URL, DATABASE_AUTHENTICATED_URL, NEON_AUTH_URL } = process.env;
if (!DATABASE_URL || !DATABASE_AUTHENTICATED_URL || !NEON_AUTH_URL) {
	throw new Error(
		'DATABASE_URL, DATABASE_AUTHENTICATED_URL and NEON_AUTH_URL must be set',
	);
}

// Neon Auth allows localhost origins on this branch.
const ORIGIN = 'http://localhost:5173';
const adminPool = new Pool({ connectionString: DATABASE_URL });
const admin = drizzle({ client: adminPool });
const authed = createAuthenticatedDb({
	connectionString: DATABASE_AUTHENTICATED_URL,
	authUrl: NEON_AUTH_URL,
});

async function authFetch(
	path: string,
	init: RequestInit & { cookie?: string } = {},
) {
	const res = await fetch(`${NEON_AUTH_URL}${path}`, {
		...init,
		headers: {
			'content-type': 'application/json',
			origin: ORIGIN,
			...(init.cookie ? { cookie: init.cookie } : {}),
		},
	});
	if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
	return res;
}

/** Signs up a verified user and returns their id and a fresh JWT. */
async function makeUser(label: string) {
	const email = `rls-smoke-${label}-${randomUUID().slice(0, 8)}@example.com`;
	const password = randomUUID();
	await authFetch('/sign-up/email', {
		method: 'POST',
		body: JSON.stringify({ email, password, name: `RLS smoke ${label}` }),
	});
	const [row] = await admin
		.update(user)
		.set({ emailVerified: true })
		.where(eq(user.email, email))
		.returning({ id: user.id });
	assert.ok(row, `sign-up for ${email} did not create a user`);

	const signIn = await authFetch('/sign-in/email', {
		method: 'POST',
		body: JSON.stringify({ email, password }),
	});
	const cookie = signIn.headers
		.getSetCookie()
		.map((c) => c.split(';')[0])
		.join('; ');
	const tokenRes = await authFetch('/token', { cookie });
	const { token } = (await tokenRes.json()) as { token: string };
	assert.ok(token, `no JWT returned for ${email}`);
	return { id: row.id, email, token };
}

/** The message of an error or of what it wraps (drizzle wraps pg errors). */
function messages(err: unknown): string {
	const parts: string[] = [];
	let e: unknown = err;
	while (e instanceof Error) {
		parts.push(e.message);
		e = e.cause;
	}
	return parts.join(' <- ');
}

async function expectRejected(
	label: string,
	fn: () => Promise<unknown>,
	pattern?: RegExp,
) {
	await assert.rejects(
		fn,
		(err) => {
			if (pattern && !pattern.test(messages(err))) {
				throw new Error(`${label}: unexpected error: ${messages(err)}`);
			}
			return true;
		},
		`${label} should have been rejected`,
	);
	console.log(`  ok  ${label} (rejected)`);
}

/** For UPDATE/DELETE, where RLS hides the rows rather than raising. */
async function expectNoRows(label: string, fn: () => Promise<unknown[]>) {
	const rows = await fn();
	assert.equal(rows.length, 0, `${label} should have affected 0 rows`);
	console.log(`  ok  ${label} (0 rows)`);
}

function ok(label: string) {
	console.log(`  ok  ${label}`);
}

const RLS_DENIED = /row-level security/;

const created: string[] = [];
try {
	console.log('Creating users via Neon Auth...');
	const alice = await makeUser('alice');
	const bob = await makeUser('bob');
	const carol = await makeUser('carol');
	created.push(alice.id, bob.id, carol.id);

	const claims = await authed.verify(alice.token);
	assert.equal(claims.sub, alice.id);
	ok('JWT verifies against the JWKS and sub is the neon_auth user id');

	console.log('Alice (owner):');
	const household = await authed.withAuth(alice.token, async (tx) => {
		const [h] = await tx
			.insert(households)
			.values({ name: 'Smoke test house' })
			.returning();
		return h;
	});
	assert.equal(household.createdBy, alice.id);
	ok('creates a household; created_by defaults to her user id');

	const [aliceMember] = await authed.withAuth(alice.token, (tx) =>
		tx.select().from(householdMembers),
	);
	assert.equal(aliceMember.userId, alice.id);
	assert.equal(aliceMember.role, 'owner');
	assert.equal(aliceMember.displayName, 'RLS smoke alice');
	ok('is added as the owner by the trigger, named after her auth user');

	assert.equal(
		await authed.withAuth(alice.token, (tx) =>
			currentMemberId(tx, household.id),
		),
		aliceMember.id,
	);
	assert.equal(
		await authed.withAuth(alice.token, (tx) =>
			isHouseholdParent(tx, household.id),
		),
		true,
	);
	ok('currentMemberId resolves her member row; isHouseholdParent is true');

	const mia = await authed.withAuth(alice.token, async (tx) => {
		const [m] = await tx
			.insert(householdMembers)
			.values({
				householdId: household.id,
				displayName: 'Mia',
				birthYear: 2019,
				avatarColor: 'pink',
			})
			.returning();
		return m;
	});
	assert.equal(mia.userId, null);
	assert.equal(mia.role, 'kid');
	ok('creates a managed kid profile (no login, role defaults to kid)');

	await expectRejected(
		'a managed (no-login) member who is a parent',
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx.insert(householdMembers).values({
					householdId: household.id,
					displayName: 'Ghost parent',
					role: 'parent',
				}),
			),
		/household_members_managed_is_kid_check/,
	);

	const chore = await authed.withAuth(alice.token, async (tx) => {
		const [c] = await tx
			.insert(chores)
			.values({
				householdId: household.id,
				title: 'Take out trash',
				assignedMemberId: mia.id,
			})
			.returning();
		return c;
	});
	ok('creates a chore assigned to Mia by member id');
	assert.equal(chore.type, 'personal');
	assert.equal(chore.points, 10);
	assert.equal(chore.frequency, 'daily');
	assert.equal(chore.dueTime, null);
	ok('a new chore defaults to personal, 10 points, daily, no due time');

	await expectRejected(
		'assigning a chore to a member id outside the household',
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx
					.update(chores)
					.set({ assignedMemberId: randomUUID() })
					.where(eq(chores.id, chore.id)),
			),
		RLS_DENIED,
	);

	console.log('Bob (not a member yet):');
	const bobSees = await authed.withAuth(bob.token, async (tx) => ({
		households: await tx.select().from(households),
		chores: await tx.select().from(chores),
		members: await tx.select().from(householdMembers),
		invites: await tx.select().from(householdInvites),
	}));
	assert.equal(bobSees.households.length, 0);
	assert.equal(bobSees.chores.length, 0);
	assert.equal(bobSees.members.length, 0);
	assert.equal(bobSees.invites.length, 0);
	ok("sees none of Alice's households, chores, members, or invites");

	await expectRejected(
		'adding a chore to her household',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx
					.insert(chores)
					.values({ householdId: household.id, title: 'Sneaky chore' }),
			),
		RLS_DENIED,
	);
	await expectRejected(
		'adding himself as a member',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.insert(householdMembers).values({
					householdId: household.id,
					userId: bob.id,
					displayName: 'Bob',
					role: 'parent',
				}),
			),
		RLS_DENIED,
	);
	await expectNoRows('updating her chore', () =>
		authed.withAuth(bob.token, (tx) =>
			tx
				.update(chores)
				.set({ title: 'hacked' })
				.where(eq(chores.id, chore.id))
				.returning(),
		),
	);
	await expectRejected(
		'accepting an invite with a made-up token',
		() =>
			authed.withAuth(bob.token, (tx) =>
				acceptHouseholdInvite(tx, 'not-a-real-token'),
			),
		/invite not found/,
	);

	console.log('Invites:');
	const bobInvite = createInviteToken();
	const carolInvite = createInviteToken();
	const expiredInvite = createInviteToken();
	await authed.withAuth(alice.token, (tx) =>
		tx.insert(householdInvites).values([
			{
				householdId: household.id,
				email: bob.email.toUpperCase(),
				role: 'parent',
				displayName: 'Dad',
				tokenHash: bobInvite.tokenHash,
			},
			{
				householdId: household.id,
				email: carol.email,
				role: 'kid',
				displayName: 'Leo',
				birthYear: 2008,
				tokenHash: carolInvite.tokenHash,
			},
			{
				householdId: household.id,
				email: 'someone-else@example.com',
				tokenHash: expiredInvite.tokenHash,
				expiresAt: new Date(Date.now() - 60_000),
			},
		]),
	);
	ok('Alice (owner) invites Bob as a parent and Carol as a kid');

	await expectRejected(
		'inviting someone as an owner',
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx.insert(householdInvites).values({
					householdId: household.id,
					email: 'owner@example.com',
					role: 'owner',
					tokenHash: createInviteToken().tokenHash,
				}),
			),
		/household_invites_role_check/,
	);
	await expectRejected(
		"Carol accepting Bob's invite (wrong email)",
		() =>
			authed.withAuth(carol.token, (tx) =>
				acceptHouseholdInvite(tx, bobInvite.token),
			),
		/invite is for a different email/,
	);
	await expectRejected(
		'accepting an expired invite',
		() =>
			authed.withAuth(carol.token, (tx) =>
				acceptHouseholdInvite(tx, expiredInvite.token),
			),
		/invite expired/,
	);

	// Mia is the household's one kid so far; fill it to the 12-kid cap.
	const fillers = await admin
		.insert(householdMembers)
		.values(
			Array.from({ length: 11 }, (_, i) => ({
				householdId: household.id,
				role: 'kid' as const,
				displayName: `Filler ${i + 1}`,
			})),
		)
		.returning({ id: householdMembers.id });
	await expectRejected(
		'accepting a kid invite to a household with 12 kids',
		() =>
			authed.withAuth(carol.token, (tx) =>
				acceptHouseholdInvite(tx, carolInvite.token),
			),
		/household is full/,
	);
	await admin.delete(householdMembers).where(
		inArray(
			householdMembers.id,
			fillers.map((f) => f.id),
		),
	);

	const bobMemberId = await authed.withAuth(bob.token, (tx) =>
		acceptHouseholdInvite(tx, bobInvite.token),
	);
	const carolMemberId = await authed.withAuth(carol.token, (tx) =>
		acceptHouseholdInvite(tx, carolInvite.token),
	);
	const members = await authed.withAuth(carol.token, (tx) =>
		tx
			.select()
			.from(householdMembers)
			.where(eq(householdMembers.householdId, household.id)),
	);
	const byId = new Map(members.map((m) => [m.id, m]));
	assert.equal(byId.get(bobMemberId)?.role, 'parent');
	assert.equal(byId.get(bobMemberId)?.userId, bob.id);
	assert.equal(byId.get(bobMemberId)?.displayName, 'Dad');
	assert.equal(byId.get(carolMemberId)?.role, 'kid');
	assert.equal(byId.get(carolMemberId)?.displayName, 'Leo');
	assert.equal(byId.get(carolMemberId)?.birthYear, 2008);
	assert.equal(byId.get(bobMemberId)?.birthYear, null);
	assert.equal(members.length, 4);
	ok('Bob joins as a parent and Carol as a kid; Carol sees all 4 members');
	ok("Carol's member row gets the birth year from her invite");

	const [acceptedInvite] = await admin
		.select()
		.from(householdInvites)
		.where(eq(householdInvites.tokenHash, carolInvite.tokenHash));
	assert.ok(acceptedInvite.acceptedAt);
	assert.equal(acceptedInvite.acceptedMemberId, carolMemberId);
	ok('the accepted invite records when and which member row');

	await expectRejected(
		'accepting the same invite twice',
		() =>
			authed.withAuth(carol.token, (tx) =>
				acceptHouseholdInvite(tx, carolInvite.token),
			),
		/invite already accepted/,
	);

	// A second household (made as the owner, outside RLS) invites Bob, who
	// already belongs to Alice's. One household per user.
	const [otherHousehold] = await admin
		.insert(households)
		.values({
			name: 'Smoke test other house',
			createdBy: alice.id,
			// Alice's own household hasn't finished setup; only one may be unfinished.
			setupCompletedAt: new Date(),
		})
		.returning();
	const otherInvite = createInviteToken();
	await admin.insert(householdInvites).values({
		householdId: otherHousehold.id,
		email: bob.email,
		role: 'parent',
		tokenHash: otherInvite.tokenHash,
	});
	await expectRejected(
		"Bob accepting a second household's invite",
		() =>
			authed.withAuth(bob.token, (tx) =>
				acceptHouseholdInvite(tx, otherInvite.token),
			),
		/already in a household/,
	);
	await admin.delete(households).where(eq(households.id, otherHousehold.id));

	console.log('Carol (kid) running parent-only mutations:');
	assert.equal(
		await authed.withAuth(carol.token, (tx) =>
			isHouseholdParent(tx, household.id),
		),
		false,
	);
	await expectRejected(
		'requireHouseholdParent',
		() =>
			authed.withAuth(carol.token, (tx) =>
				requireHouseholdParent(tx, household.id),
			),
		/Only a parent/,
	);
	await assert.rejects(
		authed.withAuth(carol.token, (tx) =>
			requireHouseholdParent(tx, household.id),
		),
		NotHouseholdParentError,
	);
	const carolChores = await authed.withAuth(carol.token, (tx) =>
		tx.select().from(chores),
	);
	assert.equal(carolChores.length, 1);
	ok('can still read the household chores');

	await expectRejected(
		'creating a chore',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx
					.insert(chores)
					.values({ householdId: household.id, title: 'Kid chore' }),
			),
		RLS_DENIED,
	);
	await expectNoRows('editing a chore', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(chores)
				.set({ title: 'No more trash' })
				.where(eq(chores.id, chore.id))
				.returning(),
		),
	);
	await expectNoRows('deleting a chore', () =>
		authed.withAuth(carol.token, (tx) =>
			tx.delete(chores).where(eq(chores.id, chore.id)).returning(),
		),
	);
	await expectRejected(
		'creating a managed kid',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx
					.insert(householdMembers)
					.values({ householdId: household.id, displayName: 'Sneaky kid' }),
			),
		RLS_DENIED,
	);
	await expectNoRows("editing Mia's profile", () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(householdMembers)
				.set({ displayName: 'Mia the Great' })
				.where(eq(householdMembers.id, mia.id))
				.returning(),
		),
	);
	await expectNoRows('promoting herself to parent', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(householdMembers)
				.set({ role: 'parent' })
				.where(eq(householdMembers.id, carolMemberId))
				.returning(),
		),
	);
	await expectNoRows('removing Mia', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.delete(householdMembers)
				.where(eq(householdMembers.id, mia.id))
				.returning(),
		),
	);
	await expectRejected(
		'inviting someone',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx.insert(householdInvites).values({
					householdId: household.id,
					email: 'friend@example.com',
					tokenHash: createInviteToken().tokenHash,
				}),
			),
		RLS_DENIED,
	);
	await expectRejected(
		'setting a PIN',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx
					.insert(householdMemberPins)
					.values({ memberId: carolMemberId, pinHash: 'x' }),
			),
		RLS_DENIED,
	);
	await expectNoRows('renaming the household', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(households)
				.set({ name: 'Carol house' })
				.where(eq(households.id, household.id))
				.returning(),
		),
	);
	const carolSeesInvites = await authed.withAuth(carol.token, (tx) =>
		tx.select().from(householdInvites),
	);
	assert.equal(carolSeesInvites.length, 0);
	ok('sees no invites');

	console.log('Bob (parent, not owner):');
	assert.equal(
		await authed.withAuth(bob.token, (tx) =>
			isHouseholdParent(tx, household.id),
		),
		true,
	);
	ok('isHouseholdParent is true');
	const sam = await authed.withAuth(bob.token, async (tx) => {
		const [m] = await tx
			.insert(householdMembers)
			.values({ householdId: household.id, displayName: 'Baby Sam' })
			.returning();
		await tx
			.update(chores)
			.set({ assignedMemberId: carolMemberId })
			.where(eq(chores.id, chore.id));
		await tx
			.update(householdMembers)
			.set({ avatarColor: 'teal' })
			.where(eq(householdMembers.id, mia.id));
		return m;
	});
	ok("creates a managed kid, reassigns the chore, and edits Mia's profile");
	await expectRejected(
		'inviting another parent (owners only)',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.insert(householdInvites).values({
					householdId: household.id,
					email: 'grandma@example.com',
					role: 'parent',
					tokenHash: createInviteToken().tokenHash,
				}),
			),
		RLS_DENIED,
	);
	await expectRejected(
		'promoting Carol to parent',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx
					.update(householdMembers)
					.set({ role: 'parent' })
					.where(eq(householdMembers.id, carolMemberId)),
			),
		RLS_DENIED,
	);
	await expectRejected(
		'promoting himself to owner',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx
					.update(householdMembers)
					.set({ role: 'owner' })
					.where(eq(householdMembers.id, bobMemberId)),
			),
		RLS_DENIED,
	);
	await expectRejected(
		"attaching a login to Mia's row (user_id isn't updatable)",
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx
					.update(householdMembers)
					.set({ userId: bob.id })
					.where(eq(householdMembers.id, mia.id)),
			),
		/permission denied/,
	);
	await authed.withAuth(bob.token, (tx) =>
		tx
			.update(householdMembers)
			.set({ displayName: 'Papa', birthYear: 1985 })
			.where(eq(householdMembers.id, bobMemberId)),
	);
	ok('edits his own profile');
	await expectNoRows("renaming Alice's (owner) profile", () =>
		authed.withAuth(bob.token, (tx) =>
			tx
				.update(householdMembers)
				.set({ displayName: 'Boss' })
				.where(eq(householdMembers.id, aliceMember.id))
				.returning(),
		),
	);
	await expectNoRows('renaming the household', () =>
		authed.withAuth(bob.token, (tx) =>
			tx
				.update(households)
				.set({ name: 'Bob house' })
				.where(eq(households.id, household.id))
				.returning(),
		),
	);

	console.log('Acting on behalf of members:');
	const act = (token: string, memberId: string) =>
		authed.withAuth(token, (tx) => canActAsMember(tx, memberId));
	assert.equal(await act(bob.token, mia.id), true);
	assert.equal(await act(alice.token, sam.id), true);
	assert.equal(await act(bob.token, carolMemberId), false);
	assert.equal(await act(carol.token, mia.id), false);
	assert.equal(await act(carol.token, carolMemberId), true);
	ok(
		'parents act for managed kids; not for kids with a login; kids only as themselves',
	);

	console.log('Chore stages:');
	const stages = await authed.withAuth(alice.token, async (tx) => {
		await tx
			.update(chores)
			.set({ points: 20, dueTime: '20:00', description: 'Blue bags only' })
			.where(eq(chores.id, chore.id));
		return tx
			.insert(choreStages)
			.values(
				['Collect bins', 'Tie bags', 'Take to curb'].map((title, i) => ({
					householdId: household.id,
					choreId: chore.id,
					position: i + 1,
					title,
					points: 5,
				})),
			)
			.returning();
	});
	assert.equal(stages.length, 3);
	const [updatedChore] = await authed.withAuth(carol.token, (tx) =>
		tx.select().from(chores).where(eq(chores.id, chore.id)),
	);
	assert.equal(updatedChore.points, 20);
	assert.equal(updatedChore.dueTime, '20:00:00');
	ok('Alice sets points and a due time and adds 3 stages');
	const [stageEdit] = await authed.withAuth(bob.token, (tx) =>
		tx
			.update(choreStages)
			.set({ hint: 'Check the bathroom too' })
			.where(eq(choreStages.id, stages[0].id))
			.returning(),
	);
	assert.equal(stageEdit.hint, 'Check the bathroom too');
	ok('Bob (parent) edits a stage hint');
	const dishes = await authed.withAuth(bob.token, async (tx) => {
		const [c] = await tx
			.insert(chores)
			.values({
				householdId: household.id,
				title: 'Dishes',
				type: 'rotation',
				points: 15,
				frequency: 'weekly',
				dueLabel: 'after dinner',
			})
			.returning();
		const [s] = await tx
			.insert(choreStages)
			.values({
				householdId: household.id,
				choreId: c.id,
				position: 1,
				title: 'Load the dishwasher',
			})
			.returning();
		return { chore: c, stage: s };
	});
	assert.equal(dishes.chore.type, 'rotation');
	assert.equal(dishes.chore.dueLabel, 'after dinner');
	ok('Bob creates a weekly rotation chore with a stage');

	const carolStages = await authed.withAuth(carol.token, (tx) =>
		tx.select().from(choreStages),
	);
	assert.equal(carolStages.length, 4);
	ok('Carol (kid) reads every stage in the household');
	await expectRejected(
		'Carol adding a stage',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx.insert(choreStages).values({
					householdId: household.id,
					choreId: chore.id,
					position: 4,
					title: 'Kid stage',
				}),
			),
		RLS_DENIED,
	);
	await expectNoRows('Carol editing a stage', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(choreStages)
				.set({ points: 100 })
				.where(eq(choreStages.id, stages[0].id))
				.returning(),
		),
	);
	await expectNoRows('Carol deleting a stage', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.delete(choreStages)
				.where(eq(choreStages.id, stages[0].id))
				.returning(),
		),
	);
	await expectRejected(
		'two stages at the same position',
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx.insert(choreStages).values({
					householdId: household.id,
					choreId: chore.id,
					position: 2,
					title: 'Duplicate',
				}),
			),
		/chore_stages_chore_id_position_key/,
	);
	await expectRejected(
		'negative chore points',
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx.update(chores).set({ points: -5 }).where(eq(chores.id, chore.id)),
			),
		/chores_points_check/,
	);
	await expectRejected(
		'a stage whose household differs from its chore (composite FK)',
		() =>
			admin.insert(choreStages).values({
				householdId: randomUUID(),
				choreId: chore.id,
				position: 9,
				title: 'Wrong house',
			}),
		/foreign key/,
	);

	console.log('Chore instances and stage progress:');
	const today = chorePeriodStart('daily', localDate('America/Los_Angeles'));
	assert.ok(today);
	const [instance] = await authed.withAuth(carol.token, (tx) =>
		tx
			.insert(choreInstances)
			.values({
				householdId: household.id,
				choreId: chore.id,
				periodStart: today,
				assignedMemberId: carolMemberId,
			})
			.onConflictDoNothing()
			.returning(),
	);
	assert.equal(instance.periodStart, today);
	ok("Carol (kid) starts today's instance of her chore");
	const again = await authed.withAuth(bob.token, (tx) =>
		tx
			.insert(choreInstances)
			.values({
				householdId: household.id,
				choreId: chore.id,
				periodStart: today,
			})
			.onConflictDoNothing()
			.returning(),
	);
	assert.equal(again.length, 0);
	ok('a second instance for the same period is a no-op (one per period)');
	await expectNoRows('Carol reassigning the instance', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(choreInstances)
				.set({ assignedMemberId: mia.id })
				.where(eq(choreInstances.id, instance.id))
				.returning(),
		),
	);
	await expectNoRows('Carol deleting the instance', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.delete(choreInstances)
				.where(eq(choreInstances.id, instance.id))
				.returning(),
		),
	);

	const progress = (stageId: string, memberId: string) => ({
		instanceId: instance.id,
		stageId,
		choreId: chore.id,
		householdId: household.id,
		completedByMemberId: memberId,
	});
	await authed.withAuth(carol.token, (tx) =>
		tx.insert(choreStageProgress).values(progress(stages[0].id, carolMemberId)),
	);
	ok('Carol checks off stage 1 as herself');
	await expectRejected(
		'Carol checking off a stage as Mia',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx.insert(choreStageProgress).values(progress(stages[1].id, mia.id)),
			),
		RLS_DENIED,
	);
	await authed.withAuth(bob.token, (tx) =>
		tx.insert(choreStageProgress).values(progress(stages[1].id, mia.id)),
	);
	ok('Bob (parent) checks off stage 2 for Mia (managed kid)');
	await expectNoRows("Carol unchecking Mia's stage", () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.delete(choreStageProgress)
				.where(eq(choreStageProgress.stageId, stages[1].id))
				.returning(),
		),
	);
	const unchecked = await authed.withAuth(carol.token, (tx) =>
		tx
			.delete(choreStageProgress)
			.where(eq(choreStageProgress.stageId, stages[0].id))
			.returning(),
	);
	assert.equal(unchecked.length, 1);
	await authed.withAuth(carol.token, (tx) =>
		tx.insert(choreStageProgress).values(progress(stages[0].id, carolMemberId)),
	);
	ok('Carol unchecks and re-checks her own stage');
	const done = await authed.withAuth(carol.token, (tx) =>
		tx
			.select()
			.from(choreStageProgress)
			.where(eq(choreStageProgress.instanceId, instance.id)),
	);
	assert.equal(done.length, 2);
	ok('Carol sees 2 of 3 stages done this period');
	await expectRejected(
		"progress on another chore's stage (composite FK)",
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx
					.insert(choreStageProgress)
					.values(progress(dishes.stage.id, aliceMember.id)),
			),
		/chore_stage_progress_stage_fk/,
	);

	const tomorrow = await authed.withAuth(alice.token, async (tx) => {
		const [i] = await tx
			.insert(choreInstances)
			.values({
				householdId: household.id,
				choreId: chore.id,
				periodStart: addDays(today, 1),
				assignedMemberId: carolMemberId,
			})
			.returning();
		return tx
			.select()
			.from(choreStageProgress)
			.where(eq(choreStageProgress.instanceId, i.id));
	});
	assert.equal(tomorrow.length, 0);
	ok("the next period's instance starts with no stages done (reset)");

	console.log('Rotations:');
	const slot = (choreId: string, memberId: string, position: number) => ({
		choreId,
		householdId: household.id,
		memberId,
		position,
	});
	// Carol -> Mia -> (Sam, excluded) -> Bob, starting with Carol.
	const trash = await authed.withAuth(alice.token, async (tx) => {
		const [c] = await tx
			.insert(chores)
			.values({
				householdId: household.id,
				title: 'Take out trash',
				type: 'rotation',
			})
			.returning();
		await tx.insert(choreRotations).values({
			choreId: c.id,
			householdId: household.id,
			scope: 'eligible_subset',
			scopeLabel: 'Kids only',
			currentMemberId: carolMemberId,
		});
		await tx.insert(choreRotationMembers).values([
			slot(c.id, carolMemberId, 1),
			slot(c.id, mia.id, 2),
			{
				...slot(c.id, sam.id, 3),
				eligible: false,
				exclusionReason: 'Too young for hot-water handling',
			},
			slot(c.id, bobMemberId, 4),
		]);
		return c;
	});
	ok('Alice sets up a rotation and its members in one transaction');

	const carolView = await authed.withAuth(carol.token, (tx) =>
		getRotationTurns(tx, trash.id),
	);
	assert.ok(carolView);
	assert.equal(carolView.scopeLabel, 'Kids only');
	assert.equal(carolView.members.length, 4);
	assert.equal(carolView.doneLast, null);
	assert.equal(carolView.activeTurn?.memberId, carolMemberId);
	assert.equal(carolView.nextUp?.memberId, mia.id);
	assert.deepEqual(
		carolView.handoffChain.map((step) => step.member.memberId),
		[carolMemberId, mia.id, bobMemberId],
	);
	ok('Carol (kid) sees the rotation: her turn, Mia next, Sam excluded');

	await expectNoRows('Carol reordering the rotation', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(choreRotationMembers)
				.set({ position: 9 })
				.where(eq(choreRotationMembers.memberId, carolMemberId))
				.returning(),
		),
	);
	await expectNoRows('Carol moving the turn directly', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(choreRotations)
				.set({ currentMemberId: bobMemberId })
				.where(eq(choreRotations.choreId, trash.id))
				.returning(),
		),
	);
	await expectRejected(
		'a rotation with fewer than 2 eligible members',
		() =>
			authed.withAuth(alice.token, async (tx) => {
				const [c] = await tx
					.insert(chores)
					.values({
						householdId: household.id,
						title: 'Solo',
						type: 'rotation',
					})
					.returning();
				await tx.insert(choreRotations).values({
					choreId: c.id,
					householdId: household.id,
					currentMemberId: carolMemberId,
				});
				const away = { eligible: false, exclusionReason: 'Away' };
				await tx
					.insert(choreRotationMembers)
					.values([
						slot(c.id, carolMemberId, 1),
						{ ...slot(c.id, mia.id, 2), ...away },
					]);
			}),
		/at least 2 eligible members/,
	);
	await expectRejected(
		'excluding a member without a reason',
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx
					.update(choreRotationMembers)
					.set({ eligible: false })
					.where(eq(choreRotationMembers.memberId, bobMemberId)),
			),
		/chore_rotation_members_exclusion_reason_check/,
	);

	const afterCarol = await authed.withAuth(carol.token, (tx) =>
		advanceRotation(tx, trash.id, { fromMemberId: carolMemberId }),
	);
	assert.deepEqual(afterCarol, { memberId: mia.id, wrapped: false });
	ok('Carol completes her turn; it passes to Mia');
	// A parent, not Carol: Carol no longer holds the turn, so the function would
	// refuse her on privilege (checked first) before it reached the stale check.
	await assert.rejects(
		authed.withAuth(alice.token, (tx) =>
			advanceRotation(tx, trash.id, { fromMemberId: carolMemberId }),
		),
		StaleRotationTurnError,
	);
	ok('completing the same turn twice is refused (StaleRotationTurnError)');
	await expectRejected(
		'Carol completing her stale turn (privilege is checked before staleness)',
		() =>
			authed.withAuth(carol.token, (tx) =>
				advanceRotation(tx, trash.id, { fromMemberId: carolMemberId }),
			),
		/only a parent or the member whose turn it is/,
	);
	await expectRejected(
		"Carol completing Mia's turn",
		() =>
			authed.withAuth(carol.token, (tx) =>
				advanceRotation(tx, trash.id, { fromMemberId: mia.id }),
			),
		/only a parent or the member whose turn it is/,
	);
	await expectRejected(
		'Carol skipping a turn',
		() =>
			authed.withAuth(carol.token, (tx) =>
				advanceRotation(tx, trash.id, {
					fromMemberId: mia.id,
					outcome: 'skipped',
				}),
			),
		/only a parent can skip/,
	);

	const afterMia = await authed.withAuth(bob.token, (tx) =>
		advanceRotation(tx, trash.id, { fromMemberId: mia.id }),
	);
	assert.deepEqual(afterMia, { memberId: bobMemberId, wrapped: false });
	ok('Bob completes for Mia (managed kid); the turn skips Sam (excluded)');
	const afterBob = await authed.withAuth(bob.token, (tx) =>
		advanceRotation(tx, trash.id, { fromMemberId: bobMemberId }),
	);
	assert.deepEqual(afterBob, { memberId: carolMemberId, wrapped: true });
	ok('Bob completes his turn; it wraps back to Carol (Loop Reset)');
	const afterSkip = await authed.withAuth(bob.token, (tx) =>
		advanceRotation(tx, trash.id, {
			fromMemberId: carolMemberId,
			outcome: 'skipped',
		}),
	);
	assert.deepEqual(afterSkip, { memberId: mia.id, wrapped: false });
	const afterSkipView = await authed.withAuth(alice.token, (tx) =>
		getRotationTurns(tx, trash.id),
	);
	assert.equal(afterSkipView?.doneLast?.memberId, bobMemberId);
	assert.equal(afterSkipView?.activeTurn?.memberId, mia.id);
	assert.equal(afterSkipView?.nextUp?.memberId, bobMemberId);
	ok("Bob skips Carol's turn: it moves to Mia and Done Last stays Bob");

	await authed.withAuth(alice.token, (tx) =>
		tx
			.update(choreRotationMembers)
			.set({ eligible: false, exclusionReason: 'Sprained wrist' })
			.where(eq(choreRotationMembers.memberId, mia.id)),
	);
	const [afterExclude] = await authed.withAuth(alice.token, (tx) =>
		tx
			.select()
			.from(choreRotations)
			.where(eq(choreRotations.choreId, trash.id)),
	);
	assert.equal(afterExclude.currentMemberId, bobMemberId);
	ok('excluding Mia during her turn hands it to Bob right away');
	await expectRejected(
		'excluding Bob too (1 eligible member left)',
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx
					.update(choreRotationMembers)
					.set({ eligible: false, exclusionReason: 'Busy' })
					.where(eq(choreRotationMembers.memberId, bobMemberId)),
			),
		/at least 2 eligible members/,
	);
	await expectRejected(
		'adding a member from another household (composite FK)',
		() =>
			admin.insert(choreRotationMembers).values({
				choreId: trash.id,
				householdId: household.id,
				memberId: randomUUID(),
				position: 7,
			}),
		/chore_rotation_members_member_fk/,
	);

	console.log('Dave (not a member):');
	const dave = await makeUser('dave');
	created.push(dave.id);
	const daveSees = await authed.withAuth(dave.token, async (tx) => ({
		stages: await tx.select().from(choreStages),
		instances: await tx.select().from(choreInstances),
		progress: await tx.select().from(choreStageProgress),
		rotations: await tx.select().from(choreRotations),
		rotationMembers: await tx.select().from(choreRotationMembers),
	}));
	assert.deepEqual(
		[
			daveSees.stages.length,
			daveSees.instances.length,
			daveSees.progress.length,
			daveSees.rotations.length,
			daveSees.rotationMembers.length,
		],
		[0, 0, 0, 0, 0],
	);
	ok('sees no stages, instances, stage progress, or rotations');
	await expectRejected(
		"advancing the household's rotation",
		() =>
			authed.withAuth(dave.token, (tx) =>
				advanceRotation(tx, trash.id, { fromMemberId: bobMemberId }),
			),
		/no rotation for chore/,
	);
	await expectRejected(
		"starting an instance of the household's chore",
		() =>
			authed.withAuth(dave.token, (tx) =>
				tx.insert(choreInstances).values({
					householdId: household.id,
					choreId: dishes.chore.id,
					periodStart: today,
				}),
			),
		RLS_DENIED,
	);

	console.log('Completions and points:');
	const startInstance = (token: string, choreId: string, memberId: string) =>
		authed.withAuth(token, async (tx) => {
			const [row] = await tx
				.insert(choreInstances)
				.values({
					householdId: household.id,
					choreId,
					periodStart: today,
					assignedMemberId: memberId,
				})
				.returning();
			return row;
		});
	const balance = (memberId: string) =>
		authed.withAuth(alice.token, (tx) => memberPointsBalance(tx, memberId));

	// A rotation chore of its own (the one above has been advanced by now):
	// Carol has the turn, so completing it pays Carol and hands the turn to
	// Mia, in one transaction.
	const plants = await authed.withAuth(alice.token, async (tx) => {
		const [c] = await tx
			.insert(chores)
			.values({
				householdId: household.id,
				title: 'Water the plants',
				type: 'rotation',
			})
			.returning();
		await tx.insert(choreRotations).values({
			choreId: c.id,
			householdId: household.id,
			currentMemberId: carolMemberId,
		});
		await tx
			.insert(choreRotationMembers)
			.values([
				slot(c.id, carolMemberId, 1),
				slot(c.id, mia.id, 2),
				slot(c.id, bobMemberId, 3),
			]);
		return c;
	});
	const trashInstance = await startInstance(
		carol.token,
		plants.id,
		carolMemberId,
	);
	const carolBefore = await balance(carolMemberId);
	const trashDone = await authed.withAuth(carol.token, (tx) =>
		completeChore(tx, trashInstance.id),
	);
	assert.equal(trashDone.points, 10);
	assert.equal(trashDone.alreadyCompleted, false);
	assert.equal(trashDone.nextMemberId, mia.id);
	assert.equal(await balance(carolMemberId), carolBefore + 10);
	const afterTrash = await authed.withAuth(alice.token, (tx) =>
		getRotationTurns(tx, plants.id),
	);
	assert.equal(afterTrash?.activeTurn?.memberId, mia.id);
	assert.equal(afterTrash?.doneLast?.memberId, carolMemberId);
	ok('Carol completes her rotation turn: +10 pts and the turn moves to Mia');

	const trashAgain = await authed.withAuth(carol.token, (tx) =>
		completeChore(tx, trashInstance.id),
	);
	assert.equal(trashAgain.alreadyCompleted, true);
	assert.equal(trashAgain.points, 0);
	assert.equal(trashAgain.completionId, trashDone.completionId);
	assert.equal(await balance(carolMemberId), carolBefore + 10);
	const stillMia = await authed.withAuth(alice.token, (tx) =>
		getRotationTurns(tx, plants.id),
	);
	assert.equal(stillMia?.activeTurn?.memberId, mia.id);
	ok('completing again awards nothing and does not advance the turn again');

	// Someone else's chore: Mia is a managed kid, so a parent can act for her
	// but Carol (a kid) can't.
	const [feedFish] = await authed.withAuth(alice.token, (tx) =>
		tx
			.insert(chores)
			.values({
				householdId: household.id,
				title: 'Feed the fish',
				points: 5,
				assignedMemberId: mia.id,
			})
			.returning(),
	);
	const fishInstance = await startInstance(bob.token, feedFish.id, mia.id);
	await expectRejected(
		"Carol completing Mia's chore",
		() =>
			authed.withAuth(carol.token, (tx) => completeChore(tx, fishInstance.id)),
		/only a parent or the assignee/,
	);
	const miaBefore = await balance(mia.id);
	const fishDone = await authed.withAuth(bob.token, (tx) =>
		completeChore(tx, fishInstance.id),
	);
	assert.equal(fishDone.points, 5);
	assert.equal(fishDone.nextMemberId, null);
	assert.equal(await balance(mia.id), miaBefore + 5);
	ok('Bob (parent) completes the chore for Mia (managed kid): +5 pts to Mia');

	// A staged personal chore: stages unlock in order, and the last one
	// completes the chore.
	const packBag = await authed.withAuth(alice.token, async (tx) => {
		const [c] = await tx
			.insert(chores)
			.values({
				householdId: household.id,
				title: 'Pack school bag',
				points: 15,
				assignedMemberId: carolMemberId,
			})
			.returning();
		const stages = await tx
			.insert(choreStages)
			.values([
				{
					householdId: household.id,
					choreId: c.id,
					position: 1,
					title: 'Homework in',
				},
				{
					householdId: household.id,
					choreId: c.id,
					position: 2,
					title: 'Lunch in',
				},
			])
			.returning();
		return { chore: c, stages };
	});
	const [stageOne, stageTwo] = packBag.stages;
	const bagInstance = await startInstance(
		carol.token,
		packBag.chore.id,
		carolMemberId,
	);
	await expectRejected(
		'checking stage 2 before stage 1',
		() =>
			authed.withAuth(carol.token, (tx) =>
				completeChoreStage(tx, bagInstance.id, stageTwo.id),
			),
		/earlier stage/,
	);
	await assert.rejects(
		authed.withAuth(carol.token, (tx) =>
			completeChoreStage(tx, bagInstance.id, stageTwo.id),
		),
		StageLockedError,
	);
	await assert.rejects(
		authed.withAuth(carol.token, (tx) => completeChore(tx, bagInstance.id)),
		ChoreStagesIncompleteError,
	);
	ok('a locked stage and a chore with stages left are refused (typed errors)');

	const bagBefore = await balance(carolMemberId);
	const first = await authed.withAuth(carol.token, (tx) =>
		completeChoreStage(tx, bagInstance.id, stageOne.id),
	);
	assert.equal(first.choreCompleted, false);
	const firstAgain = await authed.withAuth(carol.token, (tx) =>
		completeChoreStage(tx, bagInstance.id, stageOne.id),
	);
	assert.equal(firstAgain.choreCompleted, false);
	assert.equal(await balance(carolMemberId), bagBefore);
	ok('checking stage 1 (twice) records it once and awards nothing yet');

	const last = await authed.withAuth(carol.token, (tx) =>
		completeChoreStage(tx, bagInstance.id, stageTwo.id),
	);
	assert.ok(last.choreCompleted);
	assert.equal(last.points, 15);
	assert.equal(await balance(carolMemberId), bagBefore + 15);
	const lastAgain = await authed.withAuth(carol.token, (tx) =>
		completeChoreStage(tx, bagInstance.id, stageTwo.id),
	);
	assert.ok(lastAgain.choreCompleted);
	assert.equal(lastAgain.alreadyCompleted, true);
	assert.equal(lastAgain.points, 0);
	assert.equal(await balance(carolMemberId), bagBefore + 15);
	ok('the last stage completes the chore: +15 pts once, not twice');

	// Reopen is for parents and takes the points back without deleting history.
	await expectRejected(
		'Carol reopening her own completion',
		() =>
			authed.withAuth(carol.token, (tx) =>
				reopenCompletion(tx, last.completionId),
			),
		/only a parent can reopen/,
	);
	const reopened = await authed.withAuth(bob.token, (tx) =>
		reopenCompletion(tx, last.completionId),
	);
	assert.equal(reopened, true);
	assert.equal(await balance(carolMemberId), bagBefore);
	const reopenedAgain = await authed.withAuth(bob.token, (tx) =>
		reopenCompletion(tx, last.completionId),
	);
	assert.equal(reopenedAgain, false);
	assert.equal(await balance(carolMemberId), bagBefore);
	const bagLedger = await authed.withAuth(alice.token, (tx) =>
		tx
			.select()
			.from(pointsLedger)
			.where(eq(pointsLedger.completionId, last.completionId)),
	);
	assert.deepEqual(
		bagLedger.map((r) => r.delta).sort((a, b) => a - b),
		[-15, 15],
	);
	const bagProgress = await authed.withAuth(alice.token, (tx) =>
		tx
			.select()
			.from(choreStageProgress)
			.where(eq(choreStageProgress.instanceId, bagInstance.id)),
	);
	assert.deepEqual(
		bagProgress.map((r) => r.stageId),
		[stageOne.id],
	);
	ok(
		'Bob reopens it: -15 pts via a reversing ledger row, last stage unchecked',
	);

	const redone = await authed.withAuth(carol.token, (tx) =>
		completeChoreStage(tx, bagInstance.id, stageTwo.id),
	);
	assert.ok(redone.choreCompleted);
	assert.equal(redone.points, 15);
	assert.notEqual(redone.completionId, last.completionId);
	assert.equal(await balance(carolMemberId), bagBefore + 15);
	ok('after a reopen the chore can be completed again (+15, new completion)');

	// Nobody writes the ledger or completions directly (except parent adjustments).
	await expectRejected(
		'Carol writing her own points',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx.insert(pointsLedger).values({
					householdId: household.id,
					memberId: carolMemberId,
					delta: 100,
					reason: 'adjustment',
					note: 'free points',
				}),
			),
		RLS_DENIED,
	);
	await expectRejected(
		'Bob writing a fake completion award',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.insert(pointsLedger).values({
					householdId: household.id,
					memberId: carolMemberId,
					delta: 100,
					reason: 'completion',
				}),
			),
		RLS_DENIED,
	);
	await expectRejected(
		'Bob inserting a completion row',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.insert(choreCompletions).values({
					householdId: household.id,
					choreId: packBag.chore.id,
					instanceId: bagInstance.id,
					memberId: carolMemberId,
					points: 99,
				}),
			),
		/permission denied/,
	);
	await expectRejected(
		'Bob editing a ledger row',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.update(pointsLedger).set({ delta: 1 }),
			),
		/permission denied/,
	);
	await expectRejected(
		'Bob deleting a ledger row',
		() => authed.withAuth(bob.token, (tx) => tx.delete(pointsLedger)),
		/permission denied/,
	);
	const adjustBefore = await balance(carolMemberId);
	await authed.withAuth(bob.token, (tx) =>
		tx.insert(pointsLedger).values({
			householdId: household.id,
			memberId: carolMemberId,
			delta: 3,
			reason: 'adjustment',
			note: 'Helped with groceries',
			createdBy: bob.id,
		}),
	);
	assert.equal(await balance(carolMemberId), adjustBefore + 3);
	ok('only parents add adjustments; completion rows and edits are blocked');

	// Weekly goal: per member, set by a parent.
	const monday = new Date(`${chorePeriodStart('weekly', today)}T00:00:00Z`);
	const weekly = await authed.withAuth(carol.token, (tx) =>
		weeklyPointsProgress(tx, carolMemberId, monday),
	);
	assert.equal(weekly.goal, 200);
	assert.equal(weekly.earned, 25);
	assert.equal(weekly.remaining, 175);
	await expectNoRows('Carol raising her own weekly goal', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(householdMembers)
				.set({ weeklyGoalPoints: 1 })
				.where(eq(householdMembers.id, carolMemberId))
				.returning(),
		),
	);
	await authed.withAuth(bob.token, (tx) =>
		tx
			.update(householdMembers)
			.set({ weeklyGoalPoints: 100 })
			.where(eq(householdMembers.id, carolMemberId)),
	);
	const reset = await authed.withAuth(carol.token, (tx) =>
		weeklyPointsProgress(tx, carolMemberId, monday),
	);
	assert.equal(reset.goal, 100);
	assert.equal(reset.percent, 25);
	ok(
		"weekly progress counts completions net of reversals; a parent sets Carol's goal",
	);

	// SB-74: doing a chore for someone else. The chore stays the assignee's
	// (member_id, their streak, their rotation turn), the doer gets the points.
	// Since SB-79 a kid's favour waits for the assignee's OK: Mia is a managed
	// kid, so Alice approves on Mia's profile (`actingAs`). Every favour is
	// reopened at the end, so balances are as they were.
	console.log('Doing a chore for someone else (SB-74):');
	const favourChore = (title: string, assignee: string, points = 10) =>
		authed.withAuth(alice.token, async (tx) => {
			const [c] = await tx
				.insert(chores)
				.values({
					householdId: household.id,
					title,
					points,
					assignedMemberId: assignee,
				})
				.returning();
			return c;
		});
	const completionRow = (completionId: string) =>
		admin
			.select()
			.from(choreCompletions)
			.where(eq(choreCompletions.id, completionId))
			.then(([row]) => row);
	const completionLedger = (completionId: string) =>
		admin
			.select()
			.from(pointsLedger)
			.where(eq(pointsLedger.completionId, completionId));
	const carolBeforeFavours = await balance(carolMemberId);
	const miaBeforeFavours = await balance(mia.id);

	// Carol (a kid with her own login) takes out Mia's trash.
	const miaTrash = await favourChore("Take out Mia's trash", mia.id);
	const miaTrashInstance = await startInstance(bob.token, miaTrash.id, mia.id);
	await expectRejected(
		"Carol completing Mia's chore without saying she did it",
		() =>
			authed.withAuth(carol.token, (tx) =>
				completeChore(tx, miaTrashInstance.id),
			),
		/only a parent or the assignee/,
	);
	await expectRejected(
		'Carol naming Bob as the doer',
		() =>
			authed.withAuth(carol.token, (tx) =>
				completeChore(tx, miaTrashInstance.id, { doneBy: bobMemberId }),
			),
		/only a parent or the member who did it/,
	);
	const favour = await authed.withAuth(carol.token, (tx) =>
		completeChore(tx, miaTrashInstance.id, { doneBy: carolMemberId }),
	);
	assert.equal(favour.points, 0);
	assert.equal(favour.approvalStatus, 'pending');
	assert.equal(favour.creditedMemberId, carolMemberId);
	assert.equal(await balance(carolMemberId), carolBeforeFavours);
	ok("Carol does Mia's chore: pending, no points yet (SB-79)");
	const approvedByMia = await authed.withAuth(alice.token, (tx) =>
		decideFavour(tx, favour.completionId, true, { actingAs: mia.id }),
	);
	assert.equal(approvedByMia.approvalStatus, 'approved');
	assert.equal(approvedByMia.points, 10);
	assert.equal(approvedByMia.decidedByMemberId, mia.id);
	assert.equal(await balance(carolMemberId), carolBeforeFavours + 10);
	assert.equal(await balance(mia.id), miaBeforeFavours);
	const favourRow = await completionRow(favour.completionId);
	assert.equal(favourRow.memberId, mia.id);
	assert.equal(favourRow.doneByMemberId, carolMemberId);
	assert.deepEqual(
		(await completionLedger(favour.completionId)).map((r) => [
			r.memberId,
			r.delta,
			r.reason,
		]),
		[[carolMemberId, 10, 'completion']],
	);
	ok(
		"Mia (on her profile) approves: +10 pts to Carol, none to Mia; still Mia's chore",
	);

	const favourAgain = await authed.withAuth(carol.token, (tx) =>
		completeChore(tx, miaTrashInstance.id, { doneBy: carolMemberId }),
	);
	assert.equal(favourAgain.alreadyCompleted, true);
	assert.equal(favourAgain.approvalStatus, 'approved');
	assert.equal(favourAgain.points, 0);
	assert.equal(favourAgain.creditedMemberId, carolMemberId);
	assert.equal(await balance(carolMemberId), carolBeforeFavours + 10);
	ok('repeating the favour awards nothing again');

	assert.equal(
		await authed.withAuth(bob.token, (tx) =>
			reopenCompletion(tx, favour.completionId),
		),
		true,
	);
	assert.equal(await balance(carolMemberId), carolBeforeFavours);
	assert.equal(await balance(mia.id), miaBeforeFavours);
	assert.deepEqual(
		(await completionLedger(favour.completionId))
			.map((r) => [r.memberId, r.delta] as const)
			.sort((a, b) => a[1] - b[1]),
		[
			[carolMemberId, -10],
			[carolMemberId, 10],
		],
	);
	ok('reopening the favour takes the points back from Carol, not Mia');

	// A parent records who did it: Mia (managed kid) did Carol's chore.
	const carolDishes = await favourChore("Carol's dishes", carolMemberId, 5);
	const carolDishesInstance = await startInstance(
		carol.token,
		carolDishes.id,
		carolMemberId,
	);
	await expectRejected(
		'Carol saying Mia did her chore',
		() =>
			authed.withAuth(carol.token, (tx) =>
				completeChore(tx, carolDishesInstance.id, { doneBy: mia.id }),
			),
		/only a parent or the member who did it/,
	);
	const recorded = await authed.withAuth(bob.token, (tx) =>
		completeChore(tx, carolDishesInstance.id, { doneBy: mia.id }),
	);
	assert.equal(recorded.approvalStatus, 'approved');
	assert.equal(recorded.creditedMemberId, mia.id);
	assert.equal(await balance(mia.id), miaBeforeFavours + 5);
	assert.equal(await balance(carolMemberId), carolBeforeFavours);
	assert.equal(
		(await completionRow(recorded.completionId)).doneByMemberId,
		mia.id,
	);
	ok("Bob (parent) records that Mia did Carol's chore: +5 pts to Mia");
	await authed.withAuth(bob.token, (tx) =>
		reopenCompletion(tx, recorded.completionId),
	);
	assert.equal(await balance(mia.id), miaBeforeFavours);
	ok('reopening it takes the points back from Mia');

	// Naming the assignee as the doer is the same as not naming anyone.
	const selfNamed = await authed.withAuth(carol.token, (tx) =>
		completeChore(tx, carolDishesInstance.id, { doneBy: carolMemberId }),
	);
	assert.equal(selfNamed.creditedMemberId, carolMemberId);
	assert.equal(
		(await completionRow(selfNamed.completionId)).doneByMemberId,
		null,
	);
	assert.equal(await balance(carolMemberId), carolBeforeFavours + 5);
	await authed.withAuth(bob.token, (tx) =>
		reopenCompletion(tx, selfNamed.completionId),
	);
	assert.equal(await balance(carolMemberId), carolBeforeFavours);
	ok('naming yourself as the doer of your own chore stores no doer');

	// A rotation turn done as a favour: Carol does Mia's turn. Carol can't act
	// as Mia, so this also checks the turn still advances.
	const dog = await authed.withAuth(alice.token, async (tx) => {
		const [c] = await tx
			.insert(chores)
			.values({
				householdId: household.id,
				title: 'Walk the dog',
				type: 'rotation',
			})
			.returning();
		await tx.insert(choreRotations).values({
			choreId: c.id,
			householdId: household.id,
			currentMemberId: mia.id,
		});
		await tx
			.insert(choreRotationMembers)
			.values([
				slot(c.id, mia.id, 1),
				slot(c.id, carolMemberId, 2),
				slot(c.id, bobMemberId, 3),
			]);
		return c;
	});
	const dogInstance = await startInstance(bob.token, dog.id, mia.id);
	const dogDone = await authed.withAuth(carol.token, (tx) =>
		completeChore(tx, dogInstance.id, { doneBy: carolMemberId }),
	);
	assert.equal(dogDone.creditedMemberId, carolMemberId);
	assert.equal(dogDone.approvalStatus, 'pending');
	assert.equal(dogDone.nextMemberId, null);
	assert.equal(
		(await authed.withAuth(alice.token, (tx) => getRotationTurns(tx, dog.id)))
			?.activeTurn?.memberId,
		mia.id,
	);
	ok("a pending favour turn doesn't move the rotation (SB-79)");
	const dogApproved = await authed.withAuth(bob.token, (tx) =>
		decideFavour(tx, dogDone.completionId, true),
	);
	assert.equal(dogApproved.nextMemberId, carolMemberId);
	assert.equal(await balance(carolMemberId), carolBeforeFavours + 10);
	assert.equal(await balance(mia.id), miaBeforeFavours);
	const dogTurns = await authed.withAuth(alice.token, (tx) =>
		getRotationTurns(tx, dog.id),
	);
	assert.equal(dogTurns?.doneLast?.memberId, mia.id);
	assert.equal(dogTurns?.activeTurn?.memberId, carolMemberId);
	await authed.withAuth(bob.token, (tx) =>
		reopenCompletion(tx, dogDone.completionId),
	);
	assert.equal(await balance(carolMemberId), carolBeforeFavours);
	ok(
		"Carol does Mia's rotation turn: Carol gets the points, Mia's turn is used up",
	);

	// Stages done as a favour are recorded for the doer.
	const miaRoom = await authed.withAuth(alice.token, async (tx) => {
		const [c] = await tx
			.insert(chores)
			.values({
				householdId: household.id,
				title: "Tidy Mia's room",
				points: 15,
				assignedMemberId: mia.id,
			})
			.returning();
		const stages = await tx
			.insert(choreStages)
			.values([
				{
					householdId: household.id,
					choreId: c.id,
					position: 1,
					title: 'Toys',
				},
				{
					householdId: household.id,
					choreId: c.id,
					position: 2,
					title: 'Bed',
				},
			])
			.returning();
		return { chore: c, stages };
	});
	const [roomStageOne, roomStageTwo] = miaRoom.stages;
	const roomInstance = await startInstance(bob.token, miaRoom.chore.id, mia.id);
	await expectRejected(
		"Carol checking a stage of Mia's chore as Mia",
		() =>
			authed.withAuth(carol.token, (tx) =>
				completeChoreStage(tx, roomInstance.id, roomStageOne.id),
			),
		/only a parent or the assignee/,
	);
	const roomFirst = await authed.withAuth(carol.token, (tx) =>
		completeChoreStage(tx, roomInstance.id, roomStageOne.id, {
			doneBy: carolMemberId,
		}),
	);
	assert.equal(roomFirst.choreCompleted, false);
	const roomLast = await authed.withAuth(carol.token, (tx) =>
		completeChoreStage(tx, roomInstance.id, roomStageTwo.id, {
			doneBy: carolMemberId,
		}),
	);
	assert.ok(roomLast.choreCompleted);
	assert.equal(roomLast.creditedMemberId, carolMemberId);
	assert.equal(roomLast.approvalStatus, 'pending');
	assert.equal(await balance(carolMemberId), carolBeforeFavours);
	await authed.withAuth(alice.token, (tx) =>
		decideFavour(tx, roomLast.completionId, true, { actingAs: mia.id }),
	);
	assert.equal(await balance(carolMemberId), carolBeforeFavours + 15);
	const roomProgress = await admin
		.select()
		.from(choreStageProgress)
		.where(eq(choreStageProgress.instanceId, roomInstance.id));
	assert.deepEqual(
		roomProgress.map((r) => r.completedByMemberId),
		[carolMemberId, carolMemberId],
	);
	await authed.withAuth(bob.token, (tx) =>
		reopenCompletion(tx, roomLast.completionId),
	);
	assert.equal(await balance(carolMemberId), carolBeforeFavours);
	ok("Carol checks off Mia's stages: recorded as Carol's, +15 to Carol");

	// Nobody from another household can be named as the doer.
	const [daveHouse] = await admin
		.insert(households)
		.values({
			name: 'Smoke test Dave house',
			createdBy: dave.id,
			setupCompletedAt: new Date(),
		})
		.returning();
	const [daveMember] = await admin
		.select()
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.householdId, daveHouse.id),
				eq(householdMembers.userId, dave.id),
			),
		);
	assert.ok(daveMember, "Dave's own household made him its owner");
	await assert.rejects(
		authed.withAuth(bob.token, (tx) =>
			completeChore(tx, miaTrashInstance.id, { doneBy: daveMember.id }),
		),
		ChoreDoerNotInHouseholdError,
	);
	await expectRejected(
		"Carol naming Dave (another household's member) as the doer",
		() =>
			authed.withAuth(carol.token, (tx) =>
				completeChore(tx, miaTrashInstance.id, { doneBy: daveMember.id }),
			),
		/not in this household/,
	);
	await expectRejected(
		'Dave completing our chore as himself',
		() =>
			authed.withAuth(dave.token, (tx) =>
				completeChore(tx, miaTrashInstance.id, { doneBy: daveMember.id }),
			),
		/no chore instance/,
	);
	await expectRejected(
		'Dave checking our stage as himself',
		() =>
			authed.withAuth(dave.token, (tx) =>
				completeChoreStage(tx, roomInstance.id, roomStageTwo.id, {
					doneBy: daveMember.id,
				}),
			),
		/no chore instance/,
	);
	await admin.delete(households).where(eq(households.id, daveHouse.id));
	assert.equal(await balance(mia.id), miaBeforeFavours);
	ok('a member of another household is refused as the doer (parent or kid)');

	const daveLedger = await authed.withAuth(dave.token, async (tx) => ({
		completions: await tx.select().from(choreCompletions),
		ledger: await tx.select().from(pointsLedger),
	}));
	assert.equal(daveLedger.completions.length, 0);
	assert.equal(daveLedger.ledger.length, 0);
	await expectRejected(
		"completing a chore in a household Dave isn't in",
		() =>
			authed.withAuth(dave.token, (tx) => completeChore(tx, bagInstance.id)),
		/no chore instance/,
	);

	// SB-79: a favour waits for the owner's OK. Baby Sam (a managed kid) is
	// the sibling who isn't the assignee. Alice on a kid's profile passes
	// `actingAs`, and then counts as that kid, not as a parent.
	console.log('Favours need approval (SB-79):');
	const carolBeforeApprovals = await balance(carolMemberId);
	const miaBeforeApprovals = await balance(mia.id);

	// Mia (Alice on Mia's profile) does Carol's chore: pending even though a
	// parent is signed in.
	const carolBins = await favourChore("Carol's bins", carolMemberId, 7);
	const carolBinsInstance = await startInstance(
		carol.token,
		carolBins.id,
		carolMemberId,
	);
	const miaFavour = await authed.withAuth(alice.token, (tx) =>
		completeChore(tx, carolBinsInstance.id, {
			doneBy: mia.id,
			actingAs: mia.id,
		}),
	);
	assert.equal(miaFavour.approvalStatus, 'pending');
	assert.equal(await balance(mia.id), miaBeforeApprovals);
	ok("on Mia's profile, doing Carol's chore is pending, no points");

	await expectRejected(
		'Mia (on her profile) approving her own favour',
		() =>
			authed.withAuth(alice.token, (tx) =>
				decideFavour(tx, miaFavour.completionId, true, { actingAs: mia.id }),
			),
		/a favour you did yourself/,
	);
	await expectRejected(
		"Sam (a sibling, not Carol) approving Mia's favour",
		() =>
			authed.withAuth(alice.token, (tx) =>
				decideFavour(tx, miaFavour.completionId, true, { actingAs: sam.id }),
			),
		/only the member whose chore it is, or a parent/,
	);
	await expectRejected(
		"Dave (another household) approving Mia's favour",
		() =>
			authed.withAuth(dave.token, (tx) =>
				decideFavour(tx, miaFavour.completionId, true),
			),
		/no completion/,
	);
	await expectRejected(
		"Carol asking a parent about Mia's favour (only the doer can)",
		() =>
			authed.withAuth(carol.token, (tx) =>
				escalateFavour(tx, miaFavour.completionId),
			),
		/only the member who did this favour/,
	);
	await assert.rejects(
		authed.withAuth(bob.token, (tx) =>
			reopenCompletion(tx, miaFavour.completionId),
		),
		NotAFavourError,
	);
	const carolOwn = await authed.withAuth(carol.token, (tx) =>
		completeChore(tx, carolBinsInstance.id),
	);
	assert.equal(carolOwn.alreadyCompleted, true);
	assert.equal(carolOwn.approvalStatus, 'pending');
	ok(
		"the doer, a sibling and an outsider can't decide it; it blocks Carol completing; it can't be reopened",
	);

	// Carol declines; Mia asks a parent; Carol can't decide it any more; Bob
	// approves, and that's final.
	const carolDeclines = await authed.withAuth(carol.token, (tx) =>
		decideFavour(tx, miaFavour.completionId, false),
	);
	assert.equal(carolDeclines.approvalStatus, 'declined');
	assert.equal(await balance(mia.id), miaBeforeApprovals);
	const asked = await authed.withAuth(alice.token, (tx) =>
		escalateFavour(tx, miaFavour.completionId, { actingAs: mia.id }),
	);
	assert.equal(asked.approvalStatus, 'pending');
	assert.ok(asked.escalatedAt);
	await assert.rejects(
		authed.withAuth(carol.token, (tx) =>
			decideFavour(tx, miaFavour.completionId, false),
		),
		FavourEscalatedError,
	);
	const bobApproves = await authed.withAuth(bob.token, (tx) =>
		decideFavour(tx, miaFavour.completionId, true),
	);
	assert.equal(bobApproves.approvalStatus, 'approved');
	assert.equal(bobApproves.points, 7);
	assert.equal(await balance(mia.id), miaBeforeApprovals + 7);
	const carolLate = await authed.withAuth(carol.token, (tx) =>
		decideFavour(tx, miaFavour.completionId, false),
	);
	assert.equal(carolLate.changed, false);
	assert.equal(carolLate.approvalStatus, 'approved');
	await authed.withAuth(bob.token, (tx) =>
		reopenCompletion(tx, miaFavour.completionId),
	);
	assert.equal(await balance(mia.id), miaBeforeApprovals);
	ok(
		"Carol declines, Mia asks a parent, Bob approves (+7 Mia); Carol can't overturn it",
	);

	// A parent's decline is final: the doer can't ask a parent.
	const miaBed = await favourChore("Make Mia's bed", mia.id, 4);
	const miaBedInstance = await startInstance(bob.token, miaBed.id, mia.id);
	const carolBed = await authed.withAuth(carol.token, (tx) =>
		completeChore(tx, miaBedInstance.id, { doneBy: carolMemberId }),
	);
	assert.equal(carolBed.approvalStatus, 'pending');
	await authed.withAuth(bob.token, (tx) =>
		decideFavour(tx, carolBed.completionId, false),
	);
	await assert.rejects(
		authed.withAuth(carol.token, (tx) =>
			escalateFavour(tx, carolBed.completionId),
		),
		FavourDecidedByParentError,
	);
	const miaOwnBed = await authed.withAuth(alice.token, (tx) =>
		completeChore(tx, miaBedInstance.id, { actingAs: mia.id }),
	);
	assert.equal(miaOwnBed.alreadyCompleted, false);
	assert.equal(miaOwnBed.approvalStatus, 'approved');
	assert.equal(await balance(carolMemberId), carolBeforeApprovals);
	await authed.withAuth(bob.token, (tx) =>
		reopenCompletion(tx, miaOwnBed.completionId),
	);
	ok("Bob's decline is final; the chore is open again and Mia does it herself");

	// The assignee and a parent deciding at once take turns on the row lock:
	// whichever lands second sees the first. Mia declines, then Bob's approve
	// lands and overrides it; Mia's late approve changes nothing.
	const miaShoes = await favourChore("Mia's shoes", mia.id, 3);
	const miaShoesInstance = await startInstance(bob.token, miaShoes.id, mia.id);
	const carolShoes = await authed.withAuth(carol.token, (tx) =>
		completeChore(tx, miaShoesInstance.id, { doneBy: carolMemberId }),
	);
	const [assigneeFirst, parentSecond] = await Promise.all([
		authed.withAuth(alice.token, (tx) =>
			decideFavour(tx, carolShoes.completionId, false, { actingAs: mia.id }),
		),
		authed.withAuth(bob.token, (tx) =>
			decideFavour(tx, carolShoes.completionId, true),
		),
	]);
	assert.ok(assigneeFirst.changed || parentSecond.changed);
	const shoesRow = await completionRow(carolShoes.completionId);
	// Either order ends approved: a parent's approve overrides the assignee's
	// decline, and the assignee can't overturn a parent's approve.
	assert.equal(shoesRow.approvalStatus, 'approved');
	assert.equal(shoesRow.decidedByMemberId, bobMemberId);
	assert.equal(await balance(carolMemberId), carolBeforeApprovals + 3);
	await authed.withAuth(bob.token, (tx) =>
		reopenCompletion(tx, carolShoes.completionId),
	);
	assert.equal(await balance(carolMemberId), carolBeforeApprovals);
	ok('Mia (declining) and Bob (approving) at once: the parent wins either way');

	console.log('Rewards:');
	const rewardRows = await authed.withAuth(bob.token, (tx) =>
		tx
			.insert(rewards)
			.values([
				{
					householdId: household.id,
					title: 'Screen time',
					costPoints: 10,
					createdBy: bob.id,
				},
				{
					householdId: household.id,
					title: 'Too expensive',
					costPoints: 100_000,
					createdBy: bob.id,
				},
				{
					householdId: household.id,
					title: 'Ice cream',
					costPoints: 40,
					repeatable: true,
					createdBy: bob.id,
				},
				{
					householdId: household.id,
					title: 'Sundaes on Sunday',
					costPoints: 300,
					kind: 'family_milestone',
					createdBy: bob.id,
				},
			])
			.returning(),
	);
	const reward = (title: string) => {
		const row = rewardRows.find((r) => r.title === title);
		assert.ok(row, `no reward ${title}`);
		return row;
	};
	ok('a parent adds rewards (created_by must be their own user id)');
	assert.equal(
		(await authed.withAuth(carol.token, (tx) => tx.select().from(rewards)))
			.length,
		4,
	);
	ok('a kid reads the household catalog');
	await expectRejected(
		'a kid adding a reward',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx.insert(rewards).values({
					householdId: household.id,
					title: 'Free money',
					costPoints: 1,
					createdBy: carol.id,
				}),
			),
		RLS_DENIED,
	);
	await expectNoRows('a kid editing a reward', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.update(rewards)
				.set({ costPoints: 1 })
				.where(eq(rewards.id, reward('Screen time').id))
				.returning(),
		),
	);
	await expectNoRows('a kid deleting a reward', () =>
		authed.withAuth(carol.token, (tx) =>
			tx
				.delete(rewards)
				.where(eq(rewards.id, reward('Screen time').id))
				.returning(),
		),
	);
	await expectRejected(
		'a repeatable family milestone',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.insert(rewards).values({
					householdId: household.id,
					title: 'Bad milestone',
					costPoints: 10,
					kind: 'family_milestone',
					repeatable: true,
					createdBy: bob.id,
				}),
			),
		/rewards_milestone_not_repeatable_check/,
	);
	await expectRejected(
		'a zero-cost reward',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.insert(rewards).values({
					householdId: household.id,
					title: 'Free',
					costPoints: 0,
					createdBy: bob.id,
				}),
			),
		/rewards_cost_points_check/,
	);

	// Claims go through insertRewardClaim() as the owner role, as the web app
	// does; the RLS role can only read them.
	const claimAs = (memberId: string, rewardId: string) =>
		insertRewardClaim(
			admin,
			{ id: memberId, householdId: household.id },
			rewardId,
		);
	const setBalance = async (memberId: string, target: number) => {
		const delta = target - (await balance(memberId));
		if (delta !== 0)
			await admin.insert(pointsLedger).values({
				householdId: household.id,
				memberId,
				delta,
				reason: 'adjustment',
				note: 'smoke test balance',
			});
		assert.equal(await balance(memberId), target);
	};

	await setBalance(carolMemberId, 25);
	const screen = reward('Screen time');
	const firstClaim = await claimAs(carolMemberId, screen.id);
	assert.ok(firstClaim);
	assert.equal(await balance(carolMemberId), 15);
	const [spend] = await admin
		.select()
		.from(pointsLedger)
		.where(eq(pointsLedger.rewardClaimId, firstClaim));
	assert.equal(spend.delta, -10);
	assert.equal(spend.reason, 'reward_claim');
	assert.equal(spend.note, 'Screen time');
	ok('an affordable claim writes the claim and a negative ledger row');

	assert.equal(await claimAs(carolMemberId, screen.id), null);
	assert.equal(await balance(carolMemberId), 15);
	ok('a non-repeatable reward cannot be claimed twice by the same member');
	await expectRejected(
		'a duplicate claim row slipping past the check',
		() =>
			admin.insert(rewardClaims).values({
				householdId: household.id,
				rewardId: screen.id,
				memberId: carolMemberId,
				rewardTitle: screen.title,
				costPoints: 10,
				singleUse: true,
			}),
		/reward_claims_reward_id_member_id_single_use_key/,
	);

	await setBalance(mia.id, 10);
	assert.ok(await claimAs(mia.id, screen.id));
	ok('another member can claim the same non-repeatable reward');

	assert.equal(await claimAs(carolMemberId, reward('Too expensive').id), null);
	assert.equal(
		await claimAs(carolMemberId, reward('Sundaes on Sunday').id),
		null,
	);
	assert.equal(await balance(carolMemberId), 15);
	ok('an unaffordable reward and a family milestone cannot be claimed');

	// The statement's own balance check races, so the trigger is what stops
	// concurrent claims of a repeatable reward from overspending.
	const iceCream = reward('Ice cream');
	await setBalance(carolMemberId, 50);
	const results = await Promise.allSettled(
		Array.from({ length: 6 }, () => claimAs(carolMemberId, iceCream.id)),
	);
	const won = results.filter((r) => r.status === 'fulfilled' && r.value);
	assert.equal(won.length, 1, 'exactly one concurrent claim should win');
	for (const r of results) {
		if (r.status === 'rejected')
			assert.equal(claimFailure(r.reason), 'insufficient_points');
	}
	assert.equal(await balance(carolMemberId), 10);
	ok(
		'concurrent claims of a repeatable reward cannot overspend (50 pts, cost 40)',
	);

	await setBalance(carolMemberId, 80);
	assert.ok(await claimAs(carolMemberId, iceCream.id));
	assert.ok(await claimAs(carolMemberId, iceCream.id));
	assert.equal(await balance(carolMemberId), 0);
	ok('a repeatable reward can be claimed again while affordable');

	await expectRejected(
		'the balance trigger on a direct overspend',
		() =>
			admin.insert(pointsLedger).values({
				householdId: household.id,
				memberId: carolMemberId,
				delta: -1000,
				reason: 'reward_claim',
			}),
		/not enough for a reward/,
	);

	const seenByKid = await authed.withAuth(carol.token, (tx) =>
		tx.select().from(rewardClaims),
	);
	assert.ok(seenByKid.length >= 3);
	ok('a member can read reward_claims (the SELECT grant and policy work)');
	await expectRejected(
		'a parent inserting a claim through the RLS role',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.insert(rewardClaims).values({
					householdId: household.id,
					rewardId: screen.id,
					memberId: carolMemberId,
					rewardTitle: screen.title,
					costPoints: 1,
					singleUse: false,
				}),
			),
		/permission denied/,
	);
	await expectRejected(
		'deleting a reward that has claims',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.delete(rewards).where(eq(rewards.id, screen.id)),
			),
		/reward_claims_reward_fk|foreign key/,
	);
	await admin
		.update(rewards)
		.set({ archivedAt: new Date() })
		.where(eq(rewards.id, screen.id));
	assert.equal(await claimAs(mia.id, screen.id), null);
	assert.equal(
		(
			await admin
				.select()
				.from(rewardClaims)
				.where(eq(rewardClaims.rewardId, screen.id))
		).length,
		2,
	);
	ok('an archived reward cannot be claimed and keeps its claims');

	console.log('Deleting a chore:');
	const removedChore = await authed.withAuth(alice.token, (tx) =>
		tx.delete(chores).where(eq(chores.id, dishes.chore.id)).returning(),
	);
	assert.equal(removedChore.length, 1);
	const leftover = await admin
		.select()
		.from(choreStages)
		.where(eq(choreStages.choreId, dishes.chore.id));
	assert.equal(leftover.length, 0);
	ok('Alice deletes a chore and its stages go with it (cascade)');

	console.log('PINs:');
	await authed.withAuth(bob.token, (tx) =>
		tx
			.insert(householdMemberPins)
			.values({ memberId: bobMemberId, pinHash: 'scrypt$bob' }),
	);
	await authed.withAuth(alice.token, (tx) =>
		tx
			.insert(householdMemberPins)
			.values({ memberId: aliceMember.id, pinHash: 'scrypt$alice' }),
	);
	ok('each parent sets their own PIN hash');
	const bobPins = await authed.withAuth(bob.token, (tx) =>
		tx.select().from(householdMemberPins),
	);
	assert.deepEqual(
		bobPins.map((p) => p.memberId),
		[bobMemberId],
	);
	ok("Bob sees only his own PIN, not Alice's");
	const carolPins = await authed.withAuth(carol.token, (tx) =>
		tx.select().from(householdMemberPins),
	);
	assert.equal(carolPins.length, 0);
	ok('Carol (kid) sees no PINs');
	await expectRejected(
		"Bob setting Alice's PIN",
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx
					.insert(householdMemberPins)
					.values({ memberId: aliceMember.id, pinHash: 'scrypt$evil' }),
			),
		RLS_DENIED,
	);

	const [bobPin] = bobPins;
	assert.equal(bobPin?.failedAttempts, 0);
	assert.equal(bobPin?.lockedAt, null);
	await authed.withAuth(bob.token, (tx) =>
		tx
			.update(householdMemberPins)
			.set({
				failedAttempts: 5,
				lastFailedAt: new Date(),
				lockedAt: new Date(),
			})
			.where(eq(householdMemberPins.memberId, bobMemberId)),
	);
	await authed.withAuth(bob.token, (tx) =>
		tx
			.update(householdMemberPins)
			.set({ failedAttempts: 0, lastFailedAt: null, lockedAt: null })
			.where(eq(householdMemberPins.memberId, bobMemberId)),
	);
	ok('a parent can lock and unlock their own PIN counters');
	await expectNoRows("Bob resetting Alice's PIN counters", () =>
		authed.withAuth(bob.token, (tx) =>
			tx
				.update(householdMemberPins)
				.set({ failedAttempts: 0 })
				.where(eq(householdMemberPins.memberId, aliceMember.id))
				.returning(),
		),
	);

	console.log('Device profiles:');
	await authed.withAuth(bob.token, (tx) =>
		tx.insert(deviceProfiles).values({
			deviceHash: 'device-a',
			userId: bob.id,
			activeMemberId: sam.id,
			sessionId: 'session-1',
		}),
	);
	ok('a parent records the managed kid active on a device');
	await expectRejected(
		"Alice recording a device row for Bob's user",
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx.insert(deviceProfiles).values({
					deviceHash: 'device-b',
					userId: bob.id,
					activeMemberId: null,
				}),
			),
		RLS_DENIED,
	);
	const aliceDevices = await authed.withAuth(alice.token, (tx) =>
		tx.select().from(deviceProfiles),
	);
	assert.equal(aliceDevices.length, 0);
	await expectNoRows("Alice changing Bob's device profile", () =>
		authed.withAuth(alice.token, (tx) =>
			tx
				.update(deviceProfiles)
				.set({ activeMemberId: null })
				.where(eq(deviceProfiles.deviceHash, 'device-a'))
				.returning(),
		),
	);
	ok("Alice can't see or change Bob's device profiles");

	console.log('Landing route (SB-57):');
	await authed.withAuth(bob.token, (tx) =>
		tx
			.update(deviceProfiles)
			.set({ landingRoute: 'overview' })
			.where(eq(deviceProfiles.deviceHash, 'device-a')),
	);
	const [bobDevice] = await authed.withAuth(bob.token, (tx) =>
		tx
			.select({ landingRoute: deviceProfiles.landingRoute })
			.from(deviceProfiles)
			.where(eq(deviceProfiles.deviceHash, 'device-a')),
	);
	assert.equal(bobDevice?.landingRoute, 'overview');
	await expectRejected(
		'a landing route outside the enum',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.execute(
					sql`update device_profiles set landing_route = '/evil' where device_hash = 'device-a'`,
				),
			),
		/invalid input value for enum/,
	);
	ok(
		'a parent sets the landing route for a device; only enum values are accepted',
	);
	await authed.withAuth(bob.token, (tx) =>
		tx.insert(userPreferences).values({
			userId: bob.id,
			defaultLandingRoute: 'overview',
		}),
	);
	await expectRejected(
		"Alice writing Bob's preferences",
		() =>
			authed.withAuth(alice.token, (tx) =>
				tx.insert(userPreferences).values({
					userId: bob.id,
					defaultLandingRoute: 'today',
				}),
			),
		RLS_DENIED,
	);
	const alicePrefs = await authed.withAuth(alice.token, (tx) =>
		tx.select().from(userPreferences),
	);
	assert.equal(alicePrefs.length, 0);
	await expectNoRows("Alice changing Bob's preferences", () =>
		authed.withAuth(alice.token, (tx) =>
			tx
				.update(userPreferences)
				.set({ defaultLandingRoute: 'today' })
				.where(eq(userPreferences.userId, bob.id))
				.returning(),
		),
	);
	ok("a user's default landing route is theirs alone");

	console.log('Reminders and skips:');
	// Parents write them, members read them, and only the assignee or a parent
	// may dismiss a reminder (nothing else on it). Before "Leaving and
	// removing", which takes Carol out of the household.
	const [reminderForCarol] = await admin
		.insert(choreReminders)
		.values({
			householdId: household.id,
			choreId: trash.id,
			assigneeMemberId: carolMemberId,
		})
		.returning();
	const [reminderForBob] = await admin
		.insert(choreReminders)
		.values({
			householdId: household.id,
			choreId: trash.id,
			assigneeMemberId: bobMemberId,
		})
		.returning();
	await expectRejected(
		'Carol sending a reminder',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx.insert(choreReminders).values({
					householdId: household.id,
					choreId: trash.id,
					assigneeMemberId: bobMemberId,
				}),
			),
		RLS_DENIED,
	);
	await expectRejected(
		'Carol skipping a chore',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx.insert(choreSkips).values({
					householdId: household.id,
					choreId: trash.id,
					periodStart: '2026-10-05',
					memberId: carolMemberId,
				}),
			),
		RLS_DENIED,
	);
	await expectRejected(
		'Carol editing a column other than dismissed_at',
		() =>
			authed.withAuth(carol.token, (tx) =>
				tx
					.update(choreReminders)
					.set({ assigneeMemberId: bobMemberId })
					.where(eq(choreReminders.id, reminderForCarol.id)),
			),
		/permission denied/,
	);
	await authed.withAuth(carol.token, (tx) =>
		tx
			.update(choreReminders)
			.set({ dismissedAt: new Date() })
			.where(eq(choreReminders.id, reminderForBob.id)),
	);
	const [bobReminder] = await admin
		.select({ dismissedAt: choreReminders.dismissedAt })
		.from(choreReminders)
		.where(eq(choreReminders.id, reminderForBob.id));
	assert.equal(
		bobReminder.dismissedAt,
		null,
		"Carol can't dismiss Bob's reminder",
	);
	await authed.withAuth(carol.token, (tx) =>
		tx
			.update(choreReminders)
			.set({ dismissedAt: new Date() })
			.where(eq(choreReminders.id, reminderForCarol.id)),
	);
	const [carolReminder] = await admin
		.select({ dismissedAt: choreReminders.dismissedAt })
		.from(choreReminders)
		.where(eq(choreReminders.id, reminderForCarol.id));
	assert.ok(carolReminder.dismissedAt, 'Carol dismisses her own reminder');
	await authed.withAuth(bob.token, (tx) =>
		tx.insert(choreSkips).values({
			householdId: household.id,
			choreId: trash.id,
			periodStart: '2026-10-05',
			memberId: carolMemberId,
		}),
	);
	await expectRejected(
		'logging the same skip twice',
		() =>
			authed.withAuth(bob.token, (tx) =>
				tx.insert(choreSkips).values({
					householdId: household.id,
					choreId: trash.id,
					periodStart: '2026-10-05',
					memberId: carolMemberId,
				}),
			),
		/chore_skips_chore_period_member_key/,
	);
	ok('reminders and skips: parents write, members read, assignees dismiss');

	console.log('Merging a household on invite accept (SB-76):');
	// Dave sets up his own household through RLS (so he's its owner), with a
	// managed kid, Zoe, who has 7 points.
	const [daveHome] = await authed.withAuth(dave.token, (tx) =>
		tx
			.insert(households)
			.values({ name: 'Smoke test Dave home', setupCompletedAt: new Date() })
			.returning(),
	);
	const zoe = await authed.withAuth(dave.token, async (tx) => {
		const [kid] = await tx
			.insert(householdMembers)
			.values({ householdId: daveHome.id, role: 'kid', displayName: 'Zoe' })
			.returning();
		await tx.insert(pointsLedger).values({
			householdId: daveHome.id,
			memberId: kid.id,
			delta: 7,
			reason: 'adjustment',
			note: 'Smoke test',
		});
		return kid;
	});
	const daveInvite = createInviteToken();
	const bobToDave = createInviteToken();
	await admin.insert(householdInvites).values([
		{
			householdId: household.id,
			email: dave.email,
			role: 'parent',
			tokenHash: daveInvite.tokenHash,
		},
		{
			householdId: daveHome.id,
			email: bob.email,
			role: 'parent',
			tokenHash: bobToDave.tokenHash,
		},
	]);
	const [thirdHouse] = await admin
		.insert(households)
		.values({
			name: 'Smoke test third house',
			createdBy: alice.id,
			setupCompletedAt: new Date(),
		})
		.returning();
	await expectRejected(
		"Bob (a parent, not an owner) moving Alice's household into Dave's",
		() =>
			authed.withAuth(bob.token, (tx) =>
				mergeHouseholdViaInvite(tx, bobToDave.token, household.id),
			),
		/only an owner of the household can move it/,
	);
	await expectRejected(
		"Carol merging with Dave's invite (wrong email)",
		() =>
			authed.withAuth(carol.token, (tx) =>
				mergeHouseholdViaInvite(tx, daveInvite.token, daveHome.id),
			),
		/invite is for a different email/,
	);
	await expectRejected(
		"Dave naming someone else's household",
		() =>
			authed.withAuth(dave.token, (tx) =>
				mergeHouseholdViaInvite(tx, daveInvite.token, thirdHouse.id),
			),
		/only an owner of the household can move it/,
	);
	await expectRejected(
		'Dave naming the household the invite is for',
		() =>
			authed.withAuth(dave.token, (tx) =>
				mergeHouseholdViaInvite(tx, daveInvite.token, household.id),
			),
		/that is the household the invite is for/,
	);
	await admin.delete(households).where(eq(households.id, thirdHouse.id));

	// Fill Alice's household to 12 kids: Zoe would be the 13th.
	const [{ kids }] = await admin
		.select({ kids: sql<number>`count(*)::int` })
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.householdId, household.id),
				eq(householdMembers.role, 'kid'),
			),
		);
	const mergeFillers = await admin
		.insert(householdMembers)
		.values(
			Array.from({ length: 12 - kids }, (_, i) => ({
				householdId: household.id,
				role: 'kid' as const,
				displayName: `Filler ${i + 1}`,
			})),
		)
		.returning({ id: householdMembers.id });
	await expectRejected(
		'a merge that would take the household past 12 kids',
		() =>
			authed.withAuth(dave.token, (tx) =>
				mergeHouseholdViaInvite(tx, daveInvite.token, daveHome.id),
			),
		/household is full/,
	);
	await admin.delete(householdMembers).where(
		inArray(
			householdMembers.id,
			mergeFillers.map((f) => f.id),
		),
	);

	// Atomic: a merge whose transaction fails afterwards leaves both
	// households as they were (the PGlite check in the PR also fails one
	// part-way through the function).
	await expectRejected(
		'a merge rolled back after it ran',
		() =>
			authed.withAuth(dave.token, async (tx) => {
				await mergeHouseholdViaInvite(tx, daveInvite.token, daveHome.id);
				throw new Error('roll back');
			}),
		/roll back/,
	);
	const [stillThere] = await admin
		.select()
		.from(households)
		.where(eq(households.id, daveHome.id));
	const [zoeStill] = await admin
		.select()
		.from(householdMembers)
		.where(eq(householdMembers.id, zoe.id));
	const [daveInviteRow] = await admin
		.select()
		.from(householdInvites)
		.where(eq(householdInvites.tokenHash, daveInvite.tokenHash));
	assert.ok(stillThere && zoeStill?.householdId === daveHome.id);
	assert.equal(daveInviteRow.acceptedAt, null);
	ok('a rolled-back merge leaves both households and the invite untouched');

	const daveMemberId = await authed.withAuth(dave.token, (tx) =>
		mergeHouseholdViaInvite(tx, daveInvite.token, daveHome.id),
	);
	const gone = await admin
		.select()
		.from(households)
		.where(eq(households.id, daveHome.id));
	assert.equal(gone.length, 0);
	const moved = await authed.withAuth(alice.token, (tx) =>
		tx
			.select()
			.from(householdMembers)
			.where(
				and(
					eq(householdMembers.householdId, household.id),
					inArray(householdMembers.displayName, ['Zoe']),
				),
			),
	);
	const daveRow = await authed.withAuth(dave.token, (tx) =>
		tx
			.select()
			.from(householdMembers)
			.where(eq(householdMembers.id, daveMemberId)),
	);
	assert.equal(daveRow[0]?.role, 'parent');
	assert.equal(daveRow[0]?.householdId, household.id);
	assert.equal(moved.length, 1);
	assert.equal(moved[0].userId, null);
	assert.equal(await balance(moved[0].id), 7);
	const [carried] = await admin
		.select()
		.from(pointsLedger)
		.where(eq(pointsLedger.memberId, moved[0].id));
	assert.equal(carried.reason, 'adjustment');
	assert.equal(carried.note, 'Carried over from Smoke test Dave home');
	assert.equal(carried.createdBy, dave.id);
	ok(
		"Dave moves his household into Alice's: he's a parent, Zoe keeps her 7 points, his household is gone",
	);
	await expectRejected(
		'merging with the same invite again',
		() =>
			authed.withAuth(dave.token, (tx) =>
				mergeHouseholdViaInvite(tx, daveInvite.token, daveHome.id),
			),
		/invite already accepted/,
	);

	console.log('Leaving and removing:');
	await expectNoRows('Bob removing Alice (owner)', () =>
		authed.withAuth(bob.token, (tx) =>
			tx
				.delete(householdMembers)
				.where(eq(householdMembers.id, aliceMember.id))
				.returning(),
		),
	);
	const removed = await authed.withAuth(bob.token, (tx) =>
		tx
			.delete(householdMembers)
			.where(eq(householdMembers.id, sam.id))
			.returning(),
	);
	assert.equal(removed.length, 1);
	ok('Bob (parent) removes a managed kid');
	const [deviceAfter] = await admin
		.select()
		.from(deviceProfiles)
		.where(eq(deviceProfiles.deviceHash, 'device-a'));
	assert.equal(deviceAfter?.activeMemberId, null);
	ok(
		'removing the kid clears the device profile (falls back to the parent view)',
	);
	const [choreAfter] = await authed.withAuth(alice.token, async (tx) => {
		await tx
			.delete(householdMembers)
			.where(
				and(
					eq(householdMembers.householdId, household.id),
					eq(householdMembers.userId, carol.id),
				),
			);
		return tx.select().from(chores).where(eq(chores.id, chore.id));
	});
	assert.equal(choreAfter.assignedMemberId, null);
	ok("Alice removes Carol; Carol's chore is unassigned (FK set null)");

	console.log('Without a session:');
	const noClaimsPool = new Pool({
		connectionString: DATABASE_AUTHENTICATED_URL,
	});
	try {
		const { rows } = await noClaimsPool.query(
			`select (select count(*)::int from chores) as chores,
				(select count(*)::int from household_members) as members,
				(select count(*)::int from household_member_pins) as pins,
				(select count(*)::int from device_profiles) as devices,
				(select count(*)::int from household_invites) as invites,
				(select count(*)::int from chore_stages) as stages,
				(select count(*)::int from chore_instances) as instances,
				(select count(*)::int from chore_stage_progress) as progress,
				(select count(*)::int from chore_rotations) as rotations,
				(select count(*)::int from chore_rotation_members) as rotation_members,
				(select count(*)::int from rewards) as rewards,
				(select count(*)::int from reward_claims) as reward_claims`,
		);
		assert.deepEqual(rows[0], {
			chores: 0,
			members: 0,
			pins: 0,
			devices: 0,
			invites: 0,
			stages: 0,
			instances: 0,
			progress: 0,
			rotations: 0,
			rotation_members: 0,
			rewards: 0,
			reward_claims: 0,
		});
		ok('the RLS role with no JWT claims sees 0 rows in every domain table');
	} finally {
		await noClaimsPool.end();
	}

	console.log('Foreign keys:');
	await expectRejected(
		'a chore assigned to a nonexistent member (owner role, FK only)',
		() =>
			admin.insert(chores).values({
				householdId: household.id,
				title: 'Ghost chore',
				assignedMemberId: randomUUID(),
			}),
		/foreign key/,
	);
	await expectRejected(
		'a second member row for the same user in a household',
		() =>
			admin.insert(householdMembers).values({
				householdId: household.id,
				userId: alice.id,
				displayName: 'Alice again',
			}),
		/household_members_household_id_user_id_key/,
	);

	console.log('\nAll RLS smoke checks passed.');
} finally {
	// Deleting the users cascades to their sessions/accounts and to the
	// households they created (and so their members, chores, PINs, invites).
	if (created.length > 0) {
		await admin.execute(
			sql`delete from neon_auth."user" where id in ${created}`,
		);
	}
	await authed.close();
	await adminPool.end();
}
