<script lang="ts">
	import type { Snippet } from 'svelte';
	import Toggle from './Toggle.svelte';

	interface Props {
		name: string;
		/** Whether the member is included. Bindable. */
		checked?: boolean;
		/** Why the member is excluded; shown (gray) while the toggle is off. */
		reason?: string;
		/** Status text shown (green) while the toggle is on. */
		eligibleLabel?: string;
		/** Avatar slot, e.g. the Member Avatar component. */
		avatar?: Snippet;
		/** Extra controls before the toggle, e.g. the ReorderButtons. */
		actions?: Snippet;
		disabled?: boolean;
	}

	let {
		name,
		checked = $bindable(true),
		reason,
		eligibleLabel = 'Eligible rotation member',
		avatar,
		actions,
		disabled = false,
	}: Props = $props();

	const id = $props.id();
</script>

<div
	class={[
		'flex items-center gap-12 rounded-xl border border-border-subtle p-12',
		checked ? 'bg-surface-default' : 'bg-surface-accent-base opacity-60',
	]}
	data-checked={checked}
>
	{#if avatar}
		<div class="shrink-0">{@render avatar()}</div>
	{/if}
	<div class="flex min-w-0 flex-1 flex-col gap-2">
		<span id="{id}-name" class="font-display text-[14px] font-semibold text-text-primary">
			{name}
		</span>
		<span
			id="{id}-status"
			class={['text-[11px]', checked ? 'text-text-green' : 'text-text-secondary']}
		>
			{checked ? eligibleLabel : (reason ?? '')}
		</span>
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-4">{@render actions()}</div>
	{/if}
	<Toggle
		bind:checked
		{disabled}
		aria-labelledby="{id}-name"
		aria-describedby="{id}-status"
	/>
</div>
