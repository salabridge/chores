<script lang="ts">
	import type { ChoreKind } from '#lib/chore-creator.js';
	import Callout from '../ui/Callout.svelte';

	interface Props {
		/** The chore being copied. */
		sourceTitle: string;
		sourceKind: ChoreKind;
		/** Whether the copy is of the other kind. */
		kindChanges: boolean;
		/** Archive the original when the copy is saved. Bindable. */
		checked?: boolean;
		/** Saving is in flight. */
		disabled?: boolean;
	}

	let {
		sourceTitle,
		sourceKind,
		kindChanges,
		checked = $bindable(false),
		disabled = false,
	}: Props = $props();

	const kindName = (kind: ChoreKind) =>
		kind === 'rotation' ? 'a household rotation' : 'a personal chore';
</script>

<Callout tone="info" title={`Duplicating “${sourceTitle}”`}>
	<p>
		{#if kindChanges}
			The original is {kindName(sourceKind)}. Finish setting up the new one, and
			the original can be archived when you save. Points already earned stay
			where they are.
		{:else}
			This makes a separate copy. The original stays as it is unless you archive
			it.
		{/if}
	</p>
	<label class="mt-8 flex items-center gap-8 text-[13px] font-semibold text-text-primary">
		<input type="checkbox" bind:checked {disabled} class="size-[16px] accent-accent-orange" />
		Archive the original when I save
	</label>
</Callout>
