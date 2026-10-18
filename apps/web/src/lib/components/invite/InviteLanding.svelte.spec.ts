import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

vi.mock('#lib/invite.remote.js', async () => {
	return await import('../../../../.storybook/mocks/invite-remote.ts');
});

import { links, openKidInvite, openParentInvite, token } from './fixtures.ts';
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
});
