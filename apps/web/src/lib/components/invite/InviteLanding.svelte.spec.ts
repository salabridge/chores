import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

vi.mock('#lib/invite.remote.js', async () => {
	return await import('../../../../.storybook/mocks/invite-remote.ts');
});

import {
	joinedHousehold,
	links,
	openKidInvite,
	openParentInvite,
	ownedHousehold,
	token,
} from './fixtures.ts';
import InviteLanding from './InviteLanding.svelte';

const base = { token, problem: null, ...links };

describe('InviteLanding.svelte', () => {
	it('offers sign-up and sign-in when signed out', async () => {
		render(InviteLanding, {
			...base,
			invite: openKidInvite,
			signedInAs: null,
		});
		await expect
			.element(page.getByRole('heading', { name: 'Join Burbridge Household' }))
			.toBeVisible();
		await expect
			.element(page.getByText(/Jim invited you to join .* with your own login/))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Create an account' }))
			.toHaveAttribute('href', '#signup');
		await expect
			.element(page.getByRole('link', { name: 'I already have an account' }))
			.toHaveAttribute('href', '#login');
	});

	it('shows a join button when the signed-in user can accept', async () => {
		render(InviteLanding, {
			...base,
			invite: openParentInvite,
			signedInAs: 'sam@example.com',
		});
		await expect
			.element(page.getByText(/A parent invited you .* as a parent/))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Join Burbridge Household' }))
			.toBeVisible();
	});

	it('explains a wrong-email sign-in instead of offering to join', async () => {
		render(InviteLanding, {
			...base,
			invite: openKidInvite,
			signedInAs: 'jim@example.com',
			problem: 'wrong-email',
		});
		await expect
			.element(page.getByText(/for a different email address/))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /^Join/ }))
			.not.toBeInTheDocument();
	});

	it('says why a used or expired link no longer works', async () => {
		const { unmount } = render(InviteLanding, {
			...base,
			invite: { status: 'expired' },
			signedInAs: null,
		});
		await expect.element(page.getByText(/has expired/)).toBeVisible();
		unmount();
		render(InviteLanding, {
			...base,
			invite: { status: 'accepted' },
			signedInAs: null,
		});
		await expect.element(page.getByText(/already been used/)).toBeVisible();
	});

	it('offers to send a code to an unverified user, instead of a dead end', async () => {
		render(InviteLanding, {
			...base,
			invite: openKidInvite,
			signedInAs: 'ava@example.com',
			problem: 'unverified',
			verifyEmail: createRawSnippet(() => ({
				render: () => '<button type="submit">Send a code</button>',
			})),
		});
		await expect
			.element(page.getByText(/Verify your email address before you join/))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Send a code' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /^Join/ }))
			.not.toBeInTheDocument();
	});

	it('tells someone already in a household what to do instead of joining', async () => {
		render(InviteLanding, {
			...base,
			invite: openKidInvite,
			signedInAs: 'ava@example.com',
			problem: 'already-in-household',
		});
		await expect
			.element(page.getByText(/Ask its owner to remove you/))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /^Join/ }))
			.not.toBeInTheDocument();
	});

	it('lets an owner move their household in after typing its name', async () => {
		render(InviteLanding, {
			...base,
			invite: openParentInvite,
			signedInAs: 'sam@example.com',
			problem: 'already-in-household',
			current: ownedHousehold,
		});
		await expect
			.element(page.getByText(/You'll join as a parent/))
			.toBeVisible();
		await expect.element(page.getByText('Mia', { exact: true })).toBeVisible();
		await expect.element(page.getByText('24 points')).toBeVisible();
		await expect.element(page.getByText('Pat (you)')).toBeVisible();
		await expect
			.element(
				page.getByText(
					'Quinn, Mia and Leo will join Burbridge Household with you; their points come with them.',
				),
			)
			.toBeVisible();
		await expect
			.element(
				page.getByText(
					/6 chores, 2 rewards and history \(41 completed chores\)/,
				),
			)
			.toBeVisible();
		const move = page.getByRole('button', {
			name: 'Move Pat Place into Burbridge Household',
		});
		await expect.element(move).toBeDisabled();
		await page.getByLabelText('Type Pat Place to confirm').fill('Pat');
		await expect.element(move).toBeDisabled();
		await page.getByLabelText('Type Pat Place to confirm').fill(' pat place ');
		await expect.element(move).toBeEnabled();
		await expect
			.element(page.getByRole('button', { name: /^Join/ }))
			.not.toBeInTheDocument();
	});

	it('says everyone joins as a kid on a kid invite', async () => {
		render(InviteLanding, {
			...base,
			invite: openKidInvite,
			signedInAs: 'ava@example.com',
			problem: 'already-in-household',
			current: ownedHousehold,
		});
		await expect
			.element(page.getByText(/so will everyone who comes with you/))
			.toBeVisible();
	});

	it('offers a non-owner a way to leave their household', async () => {
		render(InviteLanding, {
			...base,
			invite: openParentInvite,
			signedInAs: 'sam@example.com',
			problem: 'already-in-household',
			current: joinedHousehold,
		});
		await expect
			.element(page.getByRole('button', { name: 'Leave Pat Place' }))
			.toBeVisible();
		await expect.element(page.getByText(/stay behind/)).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /^Move/ }))
			.not.toBeInTheDocument();
	});
});
