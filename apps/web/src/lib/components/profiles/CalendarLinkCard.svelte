<script lang="ts">
	import { regenerateCalendarLink } from '#lib/calendar.remote.js';
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';

	let {
		url,
		confirm = (message: string) => window.confirm(message),
		copyText = (text: string) => navigator.clipboard.writeText(text),
	}: {
		/** The household's calendar subscription link. */
		url: string;
		/** Asks before regenerating; injectable so tests and stories needn't open a dialog. */
		confirm?: (message: string) => boolean;
		/** Puts the link on the clipboard; injectable for the same reason. */
		copyText?: (text: string) => Promise<void>;
	} = $props();

	// A regenerated link comes back from the form; until then it's the loaded one.
	const current = $derived(regenerateCalendarLink.result?.url ?? url);

	let copied = $state<'yes' | 'failed' | null>(null);
	async function copy() {
		try {
			await copyText(current);
			copied = 'yes';
		} catch {
			// Clipboard access can be refused; the link is selectable below.
			copied = 'failed';
		}
	}
</script>

<section class="flex flex-col gap-16">
	<div class="flex flex-col gap-4">
		<h2 class="text-[16px] font-bold">Calendar</h2>
		<p class="text-[14px] text-text-secondary">
			Subscribe to the household's chores in Google Calendar, Thunderbird,
			Notion Calendar or any app that can add a calendar from a link. Each chore
			shows its name and who has it.
		</p>
	</div>

	<div class="flex flex-col gap-6">
		<label for="calendar-link" class="text-[14px] font-semibold text-text-secondary">
			Calendar link
		</label>
		<input
			id="calendar-link"
			type="text"
			readonly
			value={current}
			onfocus={(event) => event.currentTarget.select()}
			class="h-[48px] w-full min-w-0 rounded-xl border border-border-orange bg-surface-default px-16 text-[14px] text-text-primary"
		/>
	</div>

	<div role="status" class="contents">
		{#if copied === 'yes'}
			<FormAlert tone="status" issues={[{ message: 'Link copied.' }]} />
		{:else if copied === 'failed'}
			<FormAlert issues={[{ message: 'Couldn’t copy. Select the link and copy it instead.' }]} />
		{/if}
	</div>
	<FormAlert issues={regenerateCalendarLink.fields.issues()} />
	{#if regenerateCalendarLink.result?.url}
		<FormAlert
			tone="status"
			issues={[
				{ message: 'New link made. Add it to your calendars again.' },
			]}
		/>
	{/if}

	<div class="flex flex-wrap gap-12">
		<SecondaryButton onclick={copy}>Copy link</SecondaryButton>
		<form
			{...regenerateCalendarLink.enhance(async ({ submit }) => {
				if (
					!confirm(
						'Make a new calendar link? The current link will stop updating, so anyone using it has to add the new one.',
					)
				)
					return;
				copied = null;
				await submit();
			})}
		>
			<SecondaryButton
				type="submit"
				variant="tinted"
				tone="red"
				pending={regenerateCalendarLink.pending > 0}
			>
				Make a new link
			</SecondaryButton>
		</form>
	</div>

	<p class="text-[13px] text-text-secondary">
		Anyone with this link can see the household's chores, so only share it with
		people who should. Calendar apps refresh on their own schedule, so changes
		can take a few hours to appear.
	</p>
</section>
