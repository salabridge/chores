<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Tone = 'orange' | 'blue';
	type Size = 'default' | 'large';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** Dot label, e.g. "Personal" or "Shared". */
		label: string;
		/** Big value, e.g. "2 chores". */
		value: string;
		caption?: string;
		tone?: Tone;
		/** `large` is Today's totals (SB-68), which grow again from lg. */
		size?: Size;
	}

	let {
		label,
		value,
		caption,
		tone = 'orange',
		size = 'default',
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

	const sizes: Record<Size, { tile: string; dot: string; value: string; caption: string }> = {
		default: {
			tile: 'gap-6 p-12',
			dot: 'size-[8px]',
			value: 'text-[18px] font-bold',
			caption: 'text-[13px]',
		},
		large: {
			tile: 'gap-8 p-16 lg:min-h-[156px] lg:p-20',
			dot: 'size-[6px]',
			value: 'text-[22px] font-semibold lg:text-[30px]',
			caption: 'text-[12px]',
		},
	};
	const z = $derived(sizes[size]);
</script>

<div
	{...rest}
	data-tone={tone}
	data-size={size}
	class={['flex min-w-0 flex-col rounded-[16px]', z.tile, t.tile, className]}
>
	<div class="flex items-center gap-6">
		<span class={['shrink-0 rounded-full', z.dot, t.dot]} aria-hidden="true"
		></span>
		<p class={['text-[11px] font-bold', t.label]}>{label}</p>
	</div>
	<p class={['font-display text-text-primary', z.value]}>{value}</p>
	{#if caption}
		<p class={['text-text-secondary', z.caption]}>{caption}</p>
	{/if}
</div>
