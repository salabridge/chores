import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import InviteLinkNotice from './InviteLinkNotice.svelte';

const link = 'https://chores.example/invite/abc123';

afterEach(() => vi.restoreAllMocks());

describe('InviteLinkNotice.svelte', () => {
	it('shows the link for the invitee with a copy button', async () => {
		render(InviteLinkNotice, { email: 'sam@example.com', link });
		await expect
			.element(page.getByLabelText('Invite link for sam@example.com'))
			.toHaveValue(link);
		await expect
			.element(page.getByRole('button', { name: 'Copy link' }))
			.toBeVisible();
		await expect.element(page.getByText(/works for 7 days/)).toBeVisible();
	});

	it('says when the copy failed, so nobody pastes a stale clipboard', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
			new Error('denied'),
		);
		render(InviteLinkNotice, { email: 'sam@example.com', link });
		await page.getByRole('button', { name: 'Copy link' }).click();
		await expect
			.element(
				page.getByText(
					"Couldn't copy. Select the link above and copy it yourself.",
				),
			)
			.toBeVisible();
	});

	it('confirms a copy, then goes back to "Copy link"', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
		render(InviteLinkNotice, { email: 'sam@example.com', link });
		await page.getByRole('button', { name: 'Copy link' }).click();
		await expect
			.element(page.getByRole('button', { name: 'Copied' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Copy link' }), {
				timeout: 3000,
			})
			.toBeVisible();
	});

	it('says when the link was also emailed', async () => {
		render(InviteLinkNotice, { email: 'sam@example.com', link, emailed: true });
		await expect
			.element(page.getByText(/We emailed the link to/))
			.toBeVisible();
	});
});
