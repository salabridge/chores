import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

vi.mock('#lib/members.remote.js', async () => {
	return await import('../../../../.storybook/mocks/members-remote.ts');
});

import { inviteNow, invites } from './fixtures.ts';
import PendingInvites from './PendingInvites.svelte';

describe('PendingInvites.svelte', () => {
	it('says when there are none', async () => {
		render(PendingInvites, { invites: [], actorRole: 'owner' });
		await expect.element(page.getByText('No pending invites.')).toBeVisible();
	});

	it('shows role, email and expiry, and marks expired invites', async () => {
		render(PendingInvites, { invites, actorRole: 'owner', now: inviteNow });
		await expect
			.element(page.getByText('Parent · sam@example.com · Expires Oct 24'))
			.toBeVisible();
		await expect.element(page.getByText('Kid · Expires Oct 22')).toBeVisible();
		await expect
			.element(page.getByText('Kid · leo@example.com · Expired'))
			.toBeVisible();
		await expect
			.element(
				page.getByRole('button', { name: 'Resend invite to leo@example.com' }),
			)
			.toHaveTextContent('Renew');
	});

	it('lets an owner manage every invite', async () => {
		render(PendingInvites, { invites, actorRole: 'owner', now: inviteNow });
		expect(
			page.getByRole('button', { name: /^Revoke invite/ }).elements(),
		).toHaveLength(3);
	});

	it("hides a parent's controls for parent invites", async () => {
		render(PendingInvites, { invites, actorRole: 'parent', now: inviteNow });
		await expect
			.element(
				page.getByRole('button', { name: 'Revoke invite to sam@example.com' }),
			)
			.not.toBeInTheDocument();
		expect(
			page.getByRole('button', { name: /^Revoke invite/ }).elements(),
		).toHaveLength(2);
	});
});
