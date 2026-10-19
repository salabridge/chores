import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

// The Storybook mock: the real module imports server code.
vi.mock('#lib/members.remote.js', async () => {
	return await import('../../../../.storybook/mocks/members-remote.ts');
});

import { members } from './fixtures.ts';
import MemberList from './MemberList.svelte';

describe('MemberList.svelte', () => {
	it('lists each member with their role', async () => {
		render(MemberList, { members });
		const list = page.getByRole('list', { name: 'Household members' });
		await expect.element(list).toBeVisible();
		await expect.element(page.getByText('Owner')).toBeVisible();
		await expect
			.element(page.getByText('Parent', { exact: true }))
			.toBeVisible();
		await expect
			.element(page.getByText('Managed kid, born 2017'))
			.toBeVisible();
		await expect.element(page.getByText('Kid with own login')).toBeVisible();
	});

	it('shows no edit controls without an actor', async () => {
		render(MemberList, { members });
		expect(
			page.getByRole('button', { name: /Edit .* avatar/ }).elements(),
		).toHaveLength(0);
	});

	it('lets an owner edit everyone', async () => {
		render(MemberList, { members, actor: { id: 'm1', role: 'owner' } });
		expect(
			page.getByRole('button', { name: /Edit .* avatar/ }).elements(),
		).toHaveLength(members.length);
	});

	it('lets a parent edit themselves and kids only', async () => {
		render(MemberList, { members, actor: { id: 'm2', role: 'parent' } });
		await expect
			.element(page.getByRole('button', { name: "Edit Sam's avatar" }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: "Edit Mia's avatar" }))
			.toBeVisible();
		expect(
			page.getByRole('button', { name: "Edit Jim's avatar" }).elements(),
		).toHaveLength(0);
	});

	it('opens the editor inline and closes it on cancel', async () => {
		render(MemberList, { members, actor: { id: 'm1', role: 'owner' } });
		await page.getByRole('button', { name: "Edit Mia's avatar" }).click();
		await expect
			.element(page.getByRole('form', { name: "Change Mia's avatar" }))
			.toBeVisible();
		await page.getByRole('button', { name: 'Cancel' }).click();
		expect(page.getByRole('form').elements()).toHaveLength(0);
	});

	it('renders one item per member', async () => {
		render(MemberList, { members });
		expect(page.getByRole('listitem').elements()).toHaveLength(members.length);
	});
});
