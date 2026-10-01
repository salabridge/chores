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
 * set up chores with stages, and Carol works through today's instance. Dave
 * signs up but never joins.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { user } from '../schema/auth-schema.ts';
import {
	choreInstances,
	choreStageProgress,
	choreStages,
	chores,
	householdInvites,
	householdMemberPins,
	householdMembers,
	households,
} from '../schema/index.ts';
import {
	acceptHouseholdInvite,
	canActAsMember,
	createAuthenticatedDb,
	createInviteToken,
	currentMemberId,
	isHouseholdParent,
	NotHouseholdParentError,
	requireHouseholdParent,
} from '../src/authenticated-db.ts';
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

	console.log('Dave (not a member):');
	const dave = await makeUser('dave');
	created.push(dave.id);
	const daveSees = await authed.withAuth(dave.token, async (tx) => ({
		stages: await tx.select().from(choreStages),
		instances: await tx.select().from(choreInstances),
		progress: await tx.select().from(choreStageProgress),
	}));
	assert.deepEqual(
		[
			daveSees.stages.length,
			daveSees.instances.length,
			daveSees.progress.length,
		],
		[0, 0, 0],
	);
	ok('sees no stages, instances, or stage progress');
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
				(select count(*)::int from household_invites) as invites,
				(select count(*)::int from chore_stages) as stages,
				(select count(*)::int from chore_instances) as instances,
				(select count(*)::int from chore_stage_progress) as progress`,
		);
		assert.deepEqual(rows[0], {
			chores: 0,
			members: 0,
			pins: 0,
			invites: 0,
			stages: 0,
			instances: 0,
			progress: 0,
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
