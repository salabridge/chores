import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

vi.mock('#lib/members.remote.js', async () => {
	return await import('../../../../.storybook/mocks/members-remote.ts');
});

import InviteMemberForm from './InviteMemberForm.svelte';

describe('InviteMemberForm.svelte', () => {
	it('offers a parent invite only to the owner', async () => {
		const { unmount } = render(InviteMemberForm, { canInviteParent: true });
		await expect
			.element(page.getByRole('radio', { name: 'A parent' }))
			.toBeVisible();
		unmount();

		render(InviteMemberForm, { canInviteParent: false });
		await expect
			.element(page.getByRole('radio', { name: 'A parent' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('radio', { name: 'A kid 13 or older' }))
			.toBeChecked();
	});

	it('asks for a birth year for kids, with the cutoff year', async () => {
		render(InviteMemberForm, { canInviteParent: true, currentYear: 2026 });
		await expect.element(page.getByLabelText('Birth year')).toBeVisible();
		await expect
			.element(page.getByText(/born in 2012 or earlier/))
			.toBeVisible();
	});

	it('only accepts a four-digit birth year', async () => {
		render(InviteMemberForm, { canInviteParent: false });
		const year = page.getByLabelText('Birth year');
		await expect.element(year).toHaveAttribute('pattern', '[0-9]{4}');
		await year.fill('2010');
		await expect.element(year).toBeValid();
	});

	it('drops the birth year for a parent', async () => {
		render(InviteMemberForm, { canInviteParent: true });
		await page.getByRole('radio', { name: 'A parent' }).click();
		await expect
			.element(page.getByLabelText('Birth year'))
			.not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Email')).toBeVisible();
	});
});
