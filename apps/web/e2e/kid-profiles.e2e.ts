import { neon } from '@neondatabase/serverless';
import { expect, type Page, test } from '@playwright/test';

// End to end for managed kid profiles (SB-51): pick a kid, act as the kid,
// switch back with the PIN, lockout, and sign-out protection.
//
// Needs a Neon dev branch (never production) with a verified, email/password
// Neon Auth account, given through the environment:
//   E2E_PARENT_EMAIL, E2E_PARENT_PASSWORD  an existing verified account
//   DATABASE_URL                           the branch's owner connection (seeding)
// The test creates (or reuses) a household for that account with one managed
// kid called "E2E Kid" (the `households_add_creator` trigger makes the account the owner), and resets the PIN and device state before each test.

const email = process.env.E2E_PARENT_EMAIL;
const password = process.env.E2E_PARENT_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;
const PIN = '4821';
const KID = 'E2E Kid';

test.skip(
	!email || !password || !databaseUrl,
	'Set E2E_PARENT_EMAIL, E2E_PARENT_PASSWORD and DATABASE_URL to run kid profile e2e',
);

const sql = () => neon(databaseUrl as string);

async function seed() {
	const db = sql();
	const [user] =
		await db`select id from neon_auth."user" where email = ${email as string}`;
	if (!user) throw new Error(`No Neon Auth user for ${email}`);

	let [parent] = await db`
		select id, household_id from household_members where user_id = ${user.id} limit 1`;
	if (!parent) {
		const [household] = await db`
			insert into households (name, created_by)
			values ('E2E household', ${user.id}) returning id`;
		[parent] = await db`
			select id, household_id from household_members
			where user_id = ${user.id} and household_id = ${household?.id}`;
	}
	if (!parent) throw new Error('Could not find or create the parent member');

	await db`
		insert into household_members (household_id, display_name, role)
		select ${parent.household_id}, ${KID}, 'kid'
		where not exists (
			select 1 from household_members
			where household_id = ${parent.household_id} and display_name = ${KID} and user_id is null)`;

	await db`delete from household_member_pins where member_id = ${parent.id}`;
	await db`delete from device_profiles where user_id = ${user.id}`;
	return { parentId: parent.id as string };
}

async function signIn(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Email address').fill(email as string);
	await page.getByLabel('Password').fill(password as string);
	await page.getByRole('button', { name: 'Sign In' }).click();
	await expect(page).toHaveURL(/\/profiles$/);
}

async function setPin(page: Page) {
	await page.getByLabel('New PIN (4 to 6 digits)').fill(PIN);
	await page.getByLabel('Confirm PIN').fill(PIN);
	await page.getByRole('button', { name: 'Save PIN' }).click();
	await expect(page.getByRole('button', { name: KID })).toBeEnabled();
}

async function openSwitchDialog(page: Page) {
	await page.getByRole('button', { name: 'Switch profile' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('managed kid profiles', () => {
	let parentId: string;

	test.beforeEach(async () => {
		({ parentId } = await seed());
	});

	test('a parent without a PIN is asked to set one before opening a kid', async ({
		page,
	}) => {
		await signIn(page);
		await expect(page.getByText('Set a parent PIN first')).toBeVisible();
		await expect(page.getByRole('button', { name: KID })).toBeDisabled();
		await setPin(page);
	});

	test('pick a kid, act as the kid, and switch back with the PIN', async ({
		page,
	}) => {
		await signIn(page);
		await setPin(page);

		// The sign-out endpoint, read while still in the parent's view so we can
		// post to it directly from kid mode below.
		await page.goto('/account');
		const signOutAction = await page
			.locator('form')
			.first()
			.getAttribute('action');
		expect(signOutAction).toBeTruthy();
		await page.goto('/profiles');

		await page.getByRole('button', { name: KID }).click();
		await expect(page).toHaveURL(/\/today$/);
		await expect(page.getByTestId('kid-mode-bar')).toContainText(KID);

		// Kid screens work; the parent portal is blocked.
		await page.goto('/rewards');
		await expect(page.getByTestId('kid-mode-bar')).toBeVisible();
		await page.goto('/account');
		await expect(page).toHaveURL(/\/today$/);

		// Signing out without the PIN fails when posted directly.
		const direct = await page.request.post(signOutAction as string, {
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			data: '',
		});
		expect(direct.status()).toBe(403);
		await page.goto('/today');
		await expect(page.getByTestId('kid-mode-bar')).toBeVisible();

		// A wrong PIN fails and keeps the kid profile.
		await openSwitchDialog(page);
		await page.getByLabel('Parent PIN', { exact: true }).fill('0000');
		await page.getByRole('button', { name: 'Switch profile' }).last().click();
		await expect(page.getByRole('alert')).toContainText('not right');
		await expect(page.getByTestId('kid-mode-bar')).toBeVisible();

		// The right PIN returns to the parent's picker.
		await page.getByLabel('Parent PIN', { exact: true }).fill(PIN);
		await page.getByRole('button', { name: 'Switch profile' }).last().click();
		await expect(page).toHaveURL(/\/profiles$/);
		await page.goto('/account');
		await expect(page).toHaveURL(/\/account$/);
		expect(parentId).toBeTruthy();
	});

	test('the kid profile survives a reload and a cleared device cookie', async ({
		page,
		context,
	}) => {
		await signIn(page);
		await setPin(page);
		await page.getByRole('button', { name: KID }).click();
		await expect(page.getByTestId('kid-mode-bar')).toBeVisible();

		await page.reload();
		await expect(page.getByTestId('kid-mode-bar')).toBeVisible();

		const cookies = await context.cookies();
		await context.clearCookies({ name: 'device-id' });
		expect(cookies.some((c) => c.name === 'device-id')).toBe(true);
		await page.goto('/today');
		await expect(page.getByTestId('kid-mode-bar')).toBeVisible();
		await page.goto('/profiles');
		await expect(page).toHaveURL(/\/today$/);
	});

	test('too many wrong PINs lock it until the account password is entered', async ({
		page,
	}) => {
		await signIn(page);
		await setPin(page);
		await page.getByRole('button', { name: KID }).click();
		await expect(page.getByTestId('kid-mode-bar')).toBeVisible();

		// One failure away from the lock, and past the cool-down.
		await sql()`
			update household_member_pins
			set failed_attempts = 4, last_failed_at = now() - interval '1 hour'
			where member_id = ${parentId}`;

		await openSwitchDialog(page);
		await page.getByLabel('Parent PIN', { exact: true }).fill('0000');
		await page.getByRole('button', { name: 'Switch profile' }).last().click();
		await expect(page.getByLabel('Account password').first()).toBeVisible();

		// Even the right PIN no longer works; the password unlocks it.
		await page
			.getByLabel('Account password')
			.first()
			.fill(password as string);
		await page.getByRole('button', { name: 'Unlock' }).click();
		await expect(page.getByLabel('Parent PIN', { exact: true })).toBeVisible();
		await page.getByLabel('Parent PIN', { exact: true }).fill(PIN);
		await page.getByRole('button', { name: 'Switch profile' }).last().click();
		await expect(page).toHaveURL(/\/profiles$/);
	});
});
