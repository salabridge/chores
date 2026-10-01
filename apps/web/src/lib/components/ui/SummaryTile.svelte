<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Tone = 'orange' | 'blue';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** Dot label, e.g. "Personal" or "Shared". */
		label: string;
		/** Big value, e.g. "2 chores". */
		value: string;
		caption?: string;
		tone?: Tone;
	}

	let {
		label,
		value,
		caption,
		tone = 'orange',
		class: className,
		...rest
	}: Props = $props();

	const tones: Record<Tone, { tile: string; dot: string; label: string }> = {
		orange: {
			tile: 'bg-surface-accent-orange-subtle',
			dot: 'bg-accent-orange',
			label: 'text-text-orange',
		},
		blue: {
			tile: 'bg-surface-accent-blue-subtle',
			dot: 'bg-accent-blue',
			label: 'text-text-blue',
		},
	};
	const t = $derived(tones[tone]);
</script>

<div
	{...rest}
	data-tone={tone}
	class={['flex min-w-0 flex-col gap-6 rounded-[16px] p-12', t.tile, className]}
>
	<div class="flex items-center gap-6">
		<span class={['size-[8px] shrink-0 rounded-full', t.dot]} aria-hidden="true"
		></span>
		<p class={['text-[11px] font-bold', t.label]}>{label}</p>
	</div>
	<p class="font-display text-[18px] font-bold text-text-primary">{value}</p>
	{#if caption}
		<p class="text-[13px] text-text-secondary">{caption}</p>
	{/if}
</div>
