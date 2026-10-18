import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import InviteLinkNotice from './InviteLinkNotice.svelte';

const link = 'https://chores.example/invite/abc123';

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
});
