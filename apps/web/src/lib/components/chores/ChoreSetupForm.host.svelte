<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import ChoreSetupForm from './ChoreSetupForm.svelte';

	// Holds the draft in state, as the page does, so edits made inside the form
	// re-render. Plain objects passed as props (specs, stories) are not reactive.
	let { draft: initial, ...rest }: ComponentProps<typeof ChoreSetupForm> = $props();

	let draft = $state(structuredClone($state.snapshot(initial)));
</script>

<ChoreSetupForm bind:draft {...rest} />
