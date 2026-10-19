<script lang="ts">
	import {
		AVATAR_PRESET_CLASSES,
		AVATAR_PRESETS,
		DEFAULT_CUSTOM_COLOR,
		isHexColor,
	} from '#lib/avatar-color.js';

	interface Props {
		/** Accessible name of the group. */
		label?: string;
		/** A preset key or a `#rrggbb` hex. Bindable. */
		value?: string;
		/** Form field name; the chosen value is submitted under it. */
		name?: string;
		disabled?: boolean;
		class?: string;
	}

	const groupName = $props.id();

	let {
		label = 'Avatar colour',
		value = $bindable('orange'),
		name,
		disabled = false,
		class: className,
	}: Props = $props();

	const custom = $derived(isHexColor(value));
	// svelte-ignore state_referenced_locally
	let customHex = $state(isHexColor(value) ? value.toLowerCase() : DEFAULT_CUSTOM_COLOR);

	const chip =
		'flex cursor-pointer items-center gap-8 rounded-[10px] px-12 py-8 font-display text-[13px] font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-orange has-disabled:cursor-not-allowed has-disabled:opacity-60';
	const on = 'border-2 border-border-orange bg-surface-accent-orange-subtle px-[11px] py-[7px] text-text-orange';
	const off = 'border border-border-subtle bg-surface-default text-text-secondary';
</script>

<div role="radiogroup" aria-label={label} class={['flex flex-wrap gap-8', className]}>
	{#each AVATAR_PRESETS as preset (preset)}
		<label class={[chip, value === preset ? on : off]}>
			<input
				type="radio"
				class="sr-only"
				name={groupName}
				value={preset}
				checked={value === preset}
				{disabled}
				onchange={() => (value = preset)}
			/>
			<span
				aria-hidden="true"
				class={['size-[16px] rounded-full border-2', AVATAR_PRESET_CLASSES[preset]]}
			></span>
			{preset.charAt(0).toUpperCase() + preset.slice(1)}
		</label>
	{/each}
	<label class={[chip, custom ? on : off]}>
		<input
			type="radio"
			class="sr-only"
			name={groupName}
			value="custom"
			checked={custom}
			{disabled}
			onchange={() => (value = customHex)}
		/>
		<input
			type="color"
			aria-label="Custom colour"
			class="size-[20px] cursor-pointer rounded-full border-0 bg-transparent p-0"
			value={customHex}
			{disabled}
			oninput={(e) => {
				customHex = e.currentTarget.value.toLowerCase();
				value = customHex;
			}}
		/>
		Custom
	</label>
	{#if name}
		<input type="hidden" {name} {value} />
	{/if}
</div>
