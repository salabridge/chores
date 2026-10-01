<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Variant = 'green' | 'orange' | 'blue';
	type Size = 'default' | 'thin';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
		/** Current value, clamped to `min`..`max`. */
		value: number;
		min?: number;
		max?: number;
		/** green = weekly goal, orange = streak, blue = milestone. */
		variant?: Variant;
		/** `thin` is the slim bar used for Member Workload. */
		size?: Size;
		/** Accessible name, and the text shown on the left of the label row. */
		label?: string;
		/** Text shown on the right of the label row, e.g. "3 / 5". */
		valueLabel?: string;
	}

	let {
		value,
		min = 0,
		max = 100,
		variant = 'green',
		size = 'default',
		label,
		valueLabel,
		class: className,
		...rest
	}: Props = $props();

	const fills: Record<Variant, string> = {
		green: 'bg-accent-green',
		orange: 'bg-accent-orange',
		blue: 'bg-accent-blue',
	};

	const clamped = $derived(Math.min(Math.max(value, min), max));
	const percent = $derived(
		max > min ? ((clamped - min) / (max - min)) * 100 : 0,
	);
</script>

<div class={['flex w-full flex-col gap-6', className]}>
	{#if label || valueLabel}
		<div class="flex items-center justify-between text-[12px] font-semibold">
			<span class="text-text-primary">{label}</span>
			<span class="text-text-secondary">{valueLabel}</span>
		</div>
	{/if}
	<div
		{...rest}
		role="progressbar"
		aria-label={rest['aria-label'] ?? label}
		aria-valuenow={clamped}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuetext={valueLabel}
		class={[
			'w-full overflow-hidden rounded-full bg-surface-accent-subtle',
			size === 'thin' ? 'h-[6px]' : 'h-[8px]',
		]}
	>
		<div
			data-fill
			class={['h-full rounded-full transition-[width]', fills[variant]]}
			style:width="{percent}%"
		></div>
	</div>
</div>
