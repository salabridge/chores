import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { SaveLoopInput } from '#lib/rotation-loops.js';
import { toiletLoop } from './fixtures.ts';
import RotationLoopCard from './RotationLoopCard.svelte';

const resetName = 'Reset Shared Bathroom Toilet to its first eligible member';

function setup(
	handlers: {
		onsave?: (input: SaveLoopInput) => Promise<void>;
		onreset?: (choreId: string) => Promise<void>;
	} = {},
) {
	const onsave = vi.fn(handlers.onsave ?? (async () => {}));
	const onreset = vi.fn(handlers.onreset ?? (async () => {}));
	render(RotationLoopCard, {
		loop: toiletLoop,
		editHref: '/chores/new?edit=chore-toilet',
		onsave,
		onreset,
	});
	return { onsave, onreset };
}

describe('RotationLoopCard.svelte', () => {
	it('shows the loop, its reward, and its member rules', async () => {
		setup();
		await expect
			.element(page.getByRole('heading', { name: 'Shared Bathroom Toilet' }))
			.toBeVisible();
		await expect
			.element(page.getByText('2 eligible • 2 excluded'))
			.toBeVisible();
		await expect.element(page.getByText('20 Points')).toBeVisible();
		await expect.element(page.getByText('After completion')).toBeVisible();
		await expect
			.element(page.getByText('Leo → Mia → loop reset'))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Edit Loop' }))
			.toHaveAttribute('href', '/chores/new?edit=chore-toilet');
	});

	it('has no save buttons until something changes', async () => {
		setup();
		await expect
			.element(page.getByRole('button', { name: 'Save loop' }))
			.not.toBeInTheDocument();
	});

	it('updates live when someone is excluded, and asks for a reason', async () => {
		setup();
		await page.getByRole('switch', { name: 'Mia' }).click();
		await expect
			.element(page.getByText('1 eligible • 3 excluded'))
			.toBeVisible();
		await expect
			.element(page.getByText('Add a reason for excluding them.'))
			.toBeVisible();
		await expect
			.element(page.getByText(/Keep at least 2 members eligible/))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Save loop' }))
			.toBeDisabled();
	});

	it('saves a reorder in the order shown', async () => {
		const { onsave } = setup();
		await page.getByRole('button', { name: 'Move Mia up' }).click();
		await expect
			.element(page.getByText('Mia → Leo → loop reset'))
			.toBeVisible();
		await page.getByRole('button', { name: 'Save loop' }).click();
		expect(onsave).toHaveBeenCalledOnce();
		expect(
			onsave.mock.calls[0][0].members.map((m) => [m.memberId, m.position]),
		).toEqual([
			['mia', 1],
			['leo', 2],
			['mom', 3],
			['dad', 4],
		]);
	});

	it('saves an exclusion with the reason typed for it', async () => {
		const { onsave } = setup();
		// Bring Mom in so the loop can lose Mia and still have two eligible members.
		await page.getByRole('switch', { name: 'Mom' }).click();
		await page.getByRole('switch', { name: 'Mia' }).click();
		await page
			.getByLabelText('Reason for excluding Mia', { exact: true })
			.fill('Away this week');
		await page.getByRole('button', { name: 'Save loop' }).click();
		const input = onsave.mock.calls[0][0];
		expect(input.members.find((m) => m.memberId === 'mia')).toMatchObject({
			eligible: false,
			exclusionReason: 'Away this week',
		});
		expect(input.members.find((m) => m.memberId === 'mom')).toMatchObject({
			eligible: true,
			exclusionReason: null,
		});
	});

	it('keeps saved reasons as text until Edit reason is clicked', async () => {
		setup();
		await expect
			.element(page.getByLabelText('Reason for excluding Mom', { exact: true }))
			.not.toBeInTheDocument();
		await page
			.getByRole('button', { name: 'Edit reason for excluding Mom' })
			.click();
		await expect
			.element(page.getByLabelText('Reason for excluding Mom', { exact: true }))
			.toHaveValue('parents are not part of this kids-only rotation.');
	});

	it('discards changes', async () => {
		setup();
		await page.getByRole('button', { name: 'Move Mia up' }).click();
		await page.getByRole('button', { name: 'Discard changes' }).click();
		await expect
			.element(page.getByText('Leo → Mia → loop reset'))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Save loop' }))
			.not.toBeInTheDocument();
	});

	it('shows the message when a save fails', async () => {
		setup({
			onsave: async () => {
				throw new Error('The members changed since this page loaded.');
			},
		});
		await page.getByRole('button', { name: 'Move Mia up' }).click();
		await page.getByRole('button', { name: 'Save loop' }).click();
		await expect
			.element(page.getByTestId('save-error'))
			.toHaveTextContent('The members changed since this page loaded.');
	});

	it('only offers the scope label for an eligible subset', async () => {
		setup();
		await expect
			.element(page.getByLabelText('Scope label'))
			.toHaveValue('Kids only');
		await page.getByText('Whole Household').click();
		await expect
			.element(page.getByLabelText('Scope label'))
			.not.toBeInTheDocument();
	});

	it('asks before resetting the turn, and cancelling does nothing', async () => {
		const { onreset } = setup();
		await page.getByRole('button', { name: resetName }).click();
		await expect.element(page.getByText('Reset this loop?')).toBeVisible();
		await page.getByRole('button', { name: 'Cancel' }).click();
		expect(onreset).not.toHaveBeenCalled();
		await expect
			.element(page.getByText('Reset this loop?'))
			.not.toBeInTheDocument();
	});

	it('resets the turn once confirmed', async () => {
		const { onreset } = setup();
		await page.getByRole('button', { name: resetName }).click();
		await page.getByRole('button', { name: 'Reset turn' }).click();
		expect(onreset).toHaveBeenCalledWith('chore-toilet');
	});
});
