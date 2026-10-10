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
 * take turns on a rotation chore. Dave signs up but never joins.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { user } from '../schema/auth-schema.ts';
import {
	choreCompletions,
	choreInstances,
	choreRotationMembers,
	choreRotations,
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
} from '../schema/index.ts';
import {
	acceptHouseholdInvite,
	advanceRotation,
	ChoreStagesIncompleteError,
	canActAsMember,
	completeChore,
	completeChoreStage,
	createAuthenticatedDb,
	createInviteToken,
	currentMemberId,
	getRotationTurns,
	isHouseholdParent,
	memberPointsBalance,
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
	assert.equal(members.length, 4);
	ok('Bob joins as a parent and Carol as a kid; Carol sees all 4 members');

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
