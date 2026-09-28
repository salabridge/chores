/**
 * End-to-end check of the FKs into neon_auth and the RLS policies, using real
 * Neon Auth sessions (not the owner role). Run against a dev branch only:
 *
 *   pnpm --filter @chore/db test:rls
 *
 * Needs DATABASE_URL (owner, for setup/cleanup), DATABASE_AUTHENTICATED_URL,
 * and NEON_AUTH_URL in packages/db/.env. It signs up two throwaway users, marks
 * them verified with the owner connection (the branch requires email
 * verification), fetches a JWT for each, exercises the policies through
 * withAuth(), and deletes everything it created at the end.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { user } from '../schema/auth-schema.ts';
import { chores, householdMembers, households } from '../schema/index.ts';
import { createAuthenticatedDb } from '../src/authenticated-db.ts';

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

async function expectRejected(label: string, fn: () => Promise<unknown>) {
	await assert.rejects(fn, Error, `${label} should have been rejected`);
	console.log(`  ok  ${label} (rejected)`);
}

function ok(label: string) {
	console.log(`  ok  ${label}`);
}

const created: string[] = [];
try {
	console.log('Creating users via Neon Auth...');
	const alice = await makeUser('alice');
	const bob = await makeUser('bob');
	created.push(alice.id, bob.id);

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

	const aliceMembers = await authed.withAuth(alice.token, (tx) =>
		tx.select().from(householdMembers),
	);
	assert.deepEqual(
		aliceMembers.map((m) => [m.userId, m.role]),
		[[alice.id, 'owner']],
	);
	ok('is added as the owner by the trigger');

	const chore = await authed.withAuth(alice.token, async (tx) => {
		const [c] = await tx
			.insert(chores)
			.values({
				householdId: household.id,
				title: 'Take out trash',
				assignedTo: alice.id,
			})
			.returning();
		return c;
	});
	ok('creates a chore assigned to herself');

	await expectRejected('assigning a chore to a non-member', () =>
		authed.withAuth(alice.token, (tx) =>
			tx
				.update(chores)
				.set({ assignedTo: bob.id })
				.where(eq(chores.id, chore.id)),
		),
	);

	console.log('Bob (not a member yet):');
	const bobSees = await authed.withAuth(bob.token, async (tx) => ({
		households: await tx.select().from(households),
		chores: await tx.select().from(chores),
		members: await tx.select().from(householdMembers),
	}));
	assert.equal(bobSees.households.length, 0);
	assert.equal(bobSees.chores.length, 0);
	assert.equal(bobSees.members.length, 0);
	ok("sees none of Alice's households, chores, or members");

	await expectRejected('adding a chore to her household', () =>
		authed.withAuth(bob.token, (tx) =>
			tx
				.insert(chores)
				.values({ householdId: household.id, title: 'Sneaky chore' }),
		),
	);
	await expectRejected('adding himself as a member', () =>
		authed.withAuth(bob.token, (tx) =>
			tx
				.insert(householdMembers)
				.values({ householdId: household.id, userId: bob.id }),
		),
	);
	const bobUpdated = await authed.withAuth(bob.token, (tx) =>
		tx
			.update(chores)
			.set({ title: 'hacked' })
			.where(eq(chores.id, chore.id))
			.returning(),
	);
	assert.equal(bobUpdated.length, 0);
	ok('updating her chore changes 0 rows');

	console.log('Alice adds Bob:');
	await authed.withAuth(alice.token, (tx) =>
		tx
			.insert(householdMembers)
			.values({ householdId: household.id, userId: bob.id }),
	);
	await authed.withAuth(alice.token, (tx) =>
		tx
			.update(chores)
			.set({ assignedTo: bob.id })
			.where(eq(chores.id, chore.id)),
	);
	ok('adds Bob as a member and reassigns the chore to him');

	const bobChores = await authed.withAuth(bob.token, (tx) =>
		tx.select().from(chores),
	);
	assert.deepEqual(
		bobChores.map((c) => [c.id, c.assignedTo]),
		[[chore.id, bob.id]],
	);
	ok('Bob now sees the chore assigned to him');

	await expectRejected(
		'Bob (member, not owner) renaming the household',
		async () => {
			const rows = await authed.withAuth(bob.token, (tx) =>
				tx
					.update(households)
					.set({ name: 'Bob house' })
					.where(eq(households.id, household.id))
					.returning(),
			);
			if (rows.length === 0) throw new Error('no rows updated');
		},
	);

	console.log('Without a session:');
	const noClaimsPool = new Pool({
		connectionString: DATABASE_AUTHENTICATED_URL,
	});
	try {
		const { rows } = await noClaimsPool.query(
			'select count(*)::int as n from chores',
		);
		assert.equal(rows[0].n, 0);
		ok('the RLS role with no JWT claims sees 0 chores');
	} finally {
		await noClaimsPool.end();
	}

	console.log('Foreign keys into neon_auth.user:');
	await expectRejected(
		'a chore assigned to a nonexistent user (owner role, FK only)',
		() =>
			admin.insert(chores).values({
				householdId: household.id,
				title: 'Ghost chore',
				assignedTo: randomUUID(),
			}),
	);

	console.log('\nAll RLS smoke checks passed.');
} finally {
	// Deleting the users cascades to their sessions/accounts and to the
	// households they created (and so their members and chores).
	if (created.length > 0) {
		await admin.execute(
			sql`delete from neon_auth."user" where id in ${created}`,
		);
	}
	await authed.close();
	await adminPool.end();
}
