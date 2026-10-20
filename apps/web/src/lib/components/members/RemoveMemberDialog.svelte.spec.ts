import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

// The Storybook mock, except that submitting succeeds.
vi.mock('#lib/members.remote.js', async () => {
	const { submittable } = await import(
		'../../../../.storybook/mocks/profiles-remote.ts'
	);
	const remote = await import('../../../../.storybook/mocks/members-remote.ts');
	return { ...remote, removeMember: submittable(remote.removeMember) };
});

import { members } from './fixtures.ts';
import RemoveMemberDialog from './RemoveMemberDialog.svelte';

const [, sam, mia, ava] = members;

describe('RemoveMemberDialog.svelte', () => {
	it('says what removing does: chores unassigned, history kept', async () => {
		render(RemoveMemberDialog, { open: true, member: mia, moveTargets: [ava] });
		await expect
			.element(page.getByRole('heading', { name: 'Remove Mia?' }))
			.toBeVisible();
		await expect
			.element(page.getByText(/chores from today on are unassigned/))
			.toBeVisible();
		await expect.element(page.getByText(/history is kept/)).toBeVisible();
		// A managed kid has no account to keep.
		await expect
			.element(page.getByText(/keep their account/))
			.not.toBeInTheDocument();
	});

	it('offers to move their points to another kid, defaulting to none', async () => {
		render(RemoveMemberDialog, { open: true, member: mia, moveTargets: [ava] });
		const select = page.getByLabelText('Move their points to…');
		await expect.element(select).toHaveValue('');
		await expect
			.element(page.getByRole('option', { name: "Don't move them" }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('option', { name: 'Ava' }))
			.toBeInTheDocument();
	});

	it('tells a kid with a login they keep their account, and offers no move for a parent', async () => {
		const { unmount } = render(RemoveMemberDialog, {
			open: true,
			member: ava,
			moveTargets: [mia],
		});
		await expect.element(page.getByText(/keep their account/)).toBeVisible();
		unmount();
		render(RemoveMemberDialog, { open: true, member: sam, moveTargets: [] });
		await expect
			.element(page.getByRole('heading', { name: 'Remove Sam?' }))
			.toBeVisible();
		await expect
			.element(page.getByLabelText('Move their points to…'))
			.not.toBeInTheDocument();
	});

	it('reports who got the points after removing, and closes', async () => {
		const onremoved = vi.fn();
		render(RemoveMemberDialog, {
			open: true,
			member: mia,
			moveTargets: [ava],
			onremoved,
		});
		await page.getByLabelText('Move their points to…').selectOptions('Ava');
		await page.getByRole('button', { name: 'Remove Mia' }).click();
		await vi.waitFor(() => expect(onremoved).toHaveBeenCalledWith('Ava'));
		await expect
			.element(page.getByRole('heading', { name: 'Remove Mia?' }))
			.not.toBeInTheDocument();
	});

	it('closes on Cancel without removing', async () => {
		const onremoved = vi.fn();
		render(RemoveMemberDialog, { open: true, member: mia, onremoved });
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect
			.element(page.getByRole('heading', { name: 'Remove Mia?' }))
			.not.toBeInTheDocument();
		expect(onremoved).not.toHaveBeenCalled();
	});
});
