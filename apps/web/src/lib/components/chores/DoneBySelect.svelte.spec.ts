import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DoneBySelect from './DoneBySelect.svelte';
import { householdMembers } from './fixtures.ts';

describe('DoneBySelect.svelte', () => {
	it('lists every member under a "Done by" label', async () => {
		render(DoneBySelect, { members: householdMembers, value: 'leo' });
		const select = page.getByLabelText('Done by');
		await expect.element(select).toBeVisible();
		const options = [...select.element().querySelectorAll('option')];
		expect(options.map((o) => o.textContent)).toEqual([
			'Mom',
			'Dad',
			'Leo',
			'Mia',
		]);
	});

	it('starts on the given member (the assignee)', async () => {
		render(DoneBySelect, { members: householdMembers, value: 'leo' });
		await expect.element(page.getByLabelText('Done by')).toHaveValue('leo');
	});

	it('lets a parent pick someone else', async () => {
		render(DoneBySelect, {
			members: householdMembers,
			value: 'leo',
			name: 'doneBy',
		});
		const select = page.getByLabelText('Done by');
		await select.selectOptions('mia');
		await expect.element(select).toHaveValue('mia');
		expect((select.element() as HTMLSelectElement).name).toBe('doneBy');
	});
});
