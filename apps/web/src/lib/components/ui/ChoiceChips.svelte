<script lang="ts">
	interface Option {
		value: string | number;
		label?: string;
	}

	interface Props {
		/** Accessible name of the group, e.g. "Frequency". */
		label: string;
		options: Option[];
		/** Selected option's value. Bindable. */
		value?: string | number;
		disabled?: boolean;
		name?: string;
		class?: string;
	}

	const generatedName = $props.id();

	let {
		label,
		options,
		value = $bindable(),
		disabled = false,
		name,
		class: className,
	}: Props = $props();
</script>

<!-- Chips are native radio inputs, so arrow-key navigation comes from the browser. -->
<div role="radiogroup" aria-label={label} class={['flex flex-wrap gap-8', className]}>
	{#each options as option (option.value)}
		{@const selected = value === option.value}
		<label
			class={[
				'cursor-pointer rounded-[10px] px-12 py-8 font-display text-[13px] font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-orange has-disabled:cursor-not-allowed has-disabled:opacity-60',
				selected
					? 'border-2 border-border-orange bg-surface-accent-orange-subtle px-[11px] py-[7px] text-text-orange'
					: 'border border-border-subtle bg-surface-default text-text-secondary',
			]}
		>
			<input
				type="radio"
				class="sr-only"
				name={name ?? generatedName}
				value={String(option.value)}
				checked={selected}
				{disabled}
				onchange={() => (value = option.value)}
			/>
			{option.label ?? option.value}
		</label>
	{/each}
</div>
