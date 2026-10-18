import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

const submit = vi.hoisted(() => vi.fn(async () => true));

// The Storybook mock, except that submitting runs the component's callback
// and records whether it went on to submit.
vi.mock('#lib/members.remote.js', async () => {
	const { submittable } = await import(
		'../../../../.storybook/mocks/profiles-remote.ts'
	);
	const remote = await import('../../../../.storybook/mocks/members-remote.ts');
	return {
		...remote,
		revokeMemberInvite: submittable(remote.revokeMemberInvite, submit),
		resendMemberInvite: submittable(remote.resendMemberInvite, submit),
	};
});

import { inviteNow, invites } from './fixtures.ts';
import PendingInvites from './PendingInvites.svelte';

beforeEach(() => submit.mockClear());

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

	it('asks before revoking, and does nothing when the parent cancels', async () => {
		const confirm = vi.fn((_message: string) => false);
		render(PendingInvites, {
			invites,
			actorRole: 'owner',
			now: inviteNow,
			confirm,
		});
		await page
			.getByRole('button', { name: 'Revoke invite to sam@example.com' })
			.click();
		await expect.poll(() => confirm.mock.calls.length).toBe(1);
		expect(confirm.mock.calls[0]).toEqual([
			'Revoke the invite to sam@example.com? The link they have will stop working.',
		]);
		expect(submit).not.toHaveBeenCalled();
	});

	it('revokes once the parent confirms', async () => {
		render(PendingInvites, {
			invites,
			actorRole: 'owner',
			now: inviteNow,
			confirm: () => true,
		});
		await page
			.getByRole('button', { name: 'Revoke invite to sam@example.com' })
			.click();
		await expect.poll(() => submit.mock.calls.length).toBe(1);
	});

	it('warns that a new link breaks the one already sent', async () => {
		const confirm = vi.fn((_message: string) => false);
		render(PendingInvites, {
			invites,
			actorRole: 'owner',
			now: inviteNow,
			confirm,
		});
		await page
			.getByRole('button', { name: 'Resend invite to sam@example.com' })
			.click();
		await expect.poll(() => confirm.mock.calls.length).toBe(1);
		expect(confirm.mock.calls[0]?.[0]).toContain(
			'The link you already sent will stop working.',
		);
		expect(submit).not.toHaveBeenCalled();
	});

	it('renews an expired invite without asking', async () => {
		const confirm = vi.fn((_message: string) => false);
		render(PendingInvites, {
			invites,
			actorRole: 'owner',
			now: inviteNow,
			confirm,
		});
		await page
			.getByRole('button', { name: 'Resend invite to leo@example.com' })
			.click();
		await expect.poll(() => submit.mock.calls.length).toBe(1);
		expect(confirm).not.toHaveBeenCalled();
	});

	it('styles Revoke apart from the harmless action', async () => {
		render(PendingInvites, { invites, actorRole: 'owner', now: inviteNow });
		await expect
			.element(
				page.getByRole('button', { name: 'Revoke invite to sam@example.com' }),
			)
			.toHaveClass('text-text-red');
	});
});
