<script lang="ts">
	import FormAlert from '#lib/components/auth/FormAlert.svelte';
	import ChoiceChips from '#lib/components/ui/ChoiceChips.svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import { LANDING_LABELS, LANDING_ROUTES, type LandingRoute } from '#lib/landing.js';
	import { saveLanding } from '#lib/landing.remote.js';

	let {
		landingRoute = 'today',
	}: {
		/** The route in effect for this device. */
		landingRoute?: LandingRoute;
	} = $props();

	// svelte-ignore state_referenced_locally
	let selected = $state<string | number | undefined>(landingRoute);
	const options = LANDING_ROUTES.map((value) => ({
		value,
		label: LANDING_LABELS[value],
	}));
</script>

<form {...saveLanding} class="flex flex-col gap-16">
	<div class="flex flex-col gap-4">
		<h2 class="text-[16px] font-bold">After you sign in</h2>
		<p class="text-[14px] text-text-secondary">
			When I sign in on this device, open:
		</p>
	</div>
	<FormAlert issues={saveLanding.fields.issues()} />
	{#if saveLanding.result?.saved}
		<FormAlert tone="status" issues={[{ message: 'Saved for this device.' }]} />
	{/if}
	<ChoiceChips
		label="When I sign in on this device, open"
		name="landingRoute"
		{options}
		bind:value={selected}
	/>
	<p class="text-[13px] text-text-secondary">
		This is saved for this device only. Your other devices open the first
		screen you chose, until you choose differently on them.
	</p>
	<PrimaryButton type="submit" pending={saveLanding.pending > 0}>
		Save
	</PrimaryButton>
</form>
