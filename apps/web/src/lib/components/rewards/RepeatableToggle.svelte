<script lang="ts">
	import Toggle from '../ui/Toggle.svelte';

	interface Props {
		/** Whether the reward can be claimed again after the first claim. Bindable. */
		checked?: boolean;
		/** Prefix for the element ids that link the label and helper text. */
		id?: string;
		disabled?: boolean;
	}

	let { checked = $bindable(false), id = 'repeatable', disabled = false }: Props = $props();
</script>

<div class="flex flex-col gap-4 text-[14px] text-text-secondary">
	<div class="flex items-center justify-between gap-12">
		<span id="{id}-label">Can be claimed more than once</span>
		<Toggle
			bind:checked
			{disabled}
			aria-labelledby="{id}-label"
			aria-describedby="{id}-hint"
		/>
	</div>
	<p id="{id}-hint" class="text-[13px] text-text-secondary">
		{#if checked}
			Kids can claim this again whenever they have enough points, with no limit.
		{:else}
			Each kid can claim this once.
		{/if}
	</p>
</div>
