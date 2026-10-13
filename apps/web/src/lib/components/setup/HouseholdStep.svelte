<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import TextInput from '#lib/components/ui/TextInput.svelte';
	import { MAX_HOUSEHOLD_NAME } from '#lib/setup.js';
	import { saveHouseholdStep } from '#lib/setup.remote.js';

	let {
		name = '',
		timezone,
		onsaved,
	}: {
		/** The household name, when step 1 was already saved. */
		name?: string;
		/** The saved time zone. Left out for a new household, which defaults to the browser's. */
		timezone?: string;
		onsaved?: () => void;
	} = $props();

	const selectId = $props.id();
	// svelte-ignore state_referenced_locally
	let zone = $state(timezone ?? 'UTC');

	$effect(() => {
		if (timezone === undefined) {
			zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
		}
	});

	const zones = $derived.by(() => {
		const all =
			(
				Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
			).supportedValuesOf?.('timeZone') ?? [];
		return [...new Set([zone, ...all])];
	});
</script>

<form
	{...saveHouseholdStep.enhance(async (form) => {
		if (await form.submit()) onsaved?.();
	})}
	class="flex flex-col gap-16"
>
	<FormAlert issues={saveHouseholdStep.fields.issues()} />
	<TextInput
		{...saveHouseholdStep.fields.name.as('text')}
		label="Household name"
		placeholder="The Smiths"
		value={name}
		maxlength={MAX_HOUSEHOLD_NAME}
		autocomplete="off"
		required
	/>
	<div class="flex flex-col gap-6">
		<label for={selectId} class="text-[14px] font-semibold text-text-secondary">
			Time zone
		</label>
		<select
			{...saveHouseholdStep.fields.timezone.as('select')}
			id={selectId}
			bind:value={zone}
			class="h-[48px] w-full rounded-xl border border-border-orange bg-surface-default px-16 text-[15px] text-text-primary focus-visible:outline-2 focus-visible:outline-border-orange"
		>
			{#each zones as tz (tz)}
				<option value={tz}>{tz.replaceAll('_', ' ')}</option>
			{/each}
		</select>
		<p class="text-[13px] text-text-secondary">
			Chores reset at midnight in this time zone.
		</p>
	</div>
	<PrimaryButton type="submit" pending={saveHouseholdStep.pending > 0}>
		Continue
	</PrimaryButton>
</form>
