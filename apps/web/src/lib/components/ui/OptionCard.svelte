<script lang="ts">
	import { getContext, type Snippet } from 'svelte';
	import {
		OPTION_CARD_CONTEXT,
		type OptionCardContext,
	} from './OptionCardGroup.svelte';

	interface Props {
		value: string;
		label: string;
		/** Optional leading icon (16px). */
		icon?: Snippet;
		disabled?: boolean;
	}

	let { value, label, icon, disabled = false }: Props = $props();

	const group = getContext<OptionCardContext>(OPTION_CARD_CONTEXT);
	if (!group) {
		throw new Error('<OptionCard> must be used inside <OptionCardGroup>');
	}

	const selected = $derived(group.value === value);
	const isDisabled = $derived(disabled || group.disabled);
</script>

<label
	class={[
		'flex min-w-0 flex-1 cursor-pointer items-center gap-8 rounded-[10px] p-12 font-display text-[14px] font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-disabled:cursor-not-allowed has-disabled:opacity-60',
		!selected && 'border border-border-subtle bg-surface-default text-text-secondary',
		selected &&
			group.accent === 'orange' &&
			'border-2 border-border-orange bg-surface-accent-orange-subtle text-text-orange has-focus-visible:outline-border-orange',
		selected &&
			group.accent === 'blue' &&
			'border-2 border-border-blue bg-surface-accent-blue-subtle text-text-blue has-focus-visible:outline-border-blue',
	]}
>
	<input
		type="radio"
		class="sr-only"
		name={group.name}
		{value}
		checked={selected}
		disabled={isDisabled}
		onchange={() => group.select(value)}
	/>
	{#if icon}
		<span class="flex size-[16px] shrink-0 items-center justify-center" aria-hidden="true">
			{@render icon()}
		</span>
	{/if}
	<span>{label}</span>
</label>
