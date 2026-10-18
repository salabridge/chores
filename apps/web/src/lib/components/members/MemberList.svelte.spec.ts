import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
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

	it('renders one item per member', async () => {
		render(MemberList, { members });
		expect(page.getByRole('listitem').elements()).toHaveLength(members.length);
	});
});
