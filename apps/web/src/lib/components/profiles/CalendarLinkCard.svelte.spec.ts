import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

// The real remote file imports server code; use the Storybook stand-in. Its
// `submittable` wrapper runs the `enhance` callback so the confirm can be checked.
vi.mock('#lib/calendar.remote.js', async () => {
	const { mockForm, submittable } = await import(
		'../../../../.storybook/mocks/profiles-remote.ts'
	);
	return { regenerateCalendarLink: submittable(mockForm()) };
});

import CalendarLinkCard from './CalendarLinkCard.svelte';

const url = 'https://chores.example.com/calendar/abc.ics';

describe('CalendarLinkCard.svelte', () => {
	it('shows the calendar link', async () => {
		render(CalendarLinkCard, { url });
		await expect.element(page.getByLabelText('Calendar link')).toHaveValue(url);
	});

	it('copies the link and says so', async () => {
		const copyText = vi.fn(async () => {});
		render(CalendarLinkCard, { url, copyText });
		await page.getByRole('button', { name: 'Copy link' }).click();
		expect(copyText).toHaveBeenCalledWith(url);
		await expect.element(page.getByText('Link copied.')).toBeInTheDocument();
	});

	it('tells the parent when the clipboard is refused', async () => {
		const copyText = vi.fn(async () => {
			throw new Error('denied');
		});
		render(CalendarLinkCard, { url, copyText });
		await page.getByRole('button', { name: 'Copy link' }).click();
		await expect.element(page.getByText(/Couldn’t copy/)).toBeInTheDocument();
	});

	it('asks before making a new link, and warns that the old one stops', async () => {
		const confirm = vi.fn((_message: string) => false);
		render(CalendarLinkCard, { url, confirm });
		await page.getByRole('button', { name: 'Make a new link' }).click();
		expect(confirm).toHaveBeenCalledOnce();
		expect(confirm.mock.calls[0]?.[0]).toMatch(/stop updating/);
	});
});
