import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

// The Storybook mock, except that submitting succeeds.
vi.mock('#lib/members.remote.js', async () => {
	const { submittable } = await import(
		'../../../../.storybook/mocks/profiles-remote.ts'
	);
	const remote = await import('../../../../.storybook/mocks/members-remote.ts');
	return {
		...remote,
		updateMemberAvatar: submittable(remote.updateMemberAvatar),
	};
});

import EditMemberAvatarForm from './EditMemberAvatarForm.svelte';
import { members } from './fixtures.ts';

const mia = members[2];

describe('EditMemberAvatarForm.svelte', () => {
	it("starts on the member's current colour and offers Custom", async () => {
		render(EditMemberAvatarForm, { member: mia });
		await expect
			.element(page.getByRole('radio', { name: 'Blue' }))
			.toBeChecked();
		await expect
			.element(page.getByRole('radio', { name: 'Custom' }))
			.toBeVisible();
		await expect
			.element(page.getByLabelText('Avatar initial (optional)'))
			.toBeVisible();
	});

	it('tells the parent when it is saved or cancelled', async () => {
		const onsaved = vi.fn();
		const oncancel = vi.fn();
		render(EditMemberAvatarForm, { member: mia, onsaved, oncancel });
		await page.getByRole('radio', { name: 'Red' }).click({ force: true });
		await page.getByRole('button', { name: 'Save' }).click();
		await vi.waitFor(() => expect(onsaved).toHaveBeenCalledOnce());
		await page.getByRole('button', { name: 'Cancel' }).click();
		expect(oncancel).toHaveBeenCalledOnce();
	});
});
