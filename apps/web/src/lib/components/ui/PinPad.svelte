<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'class' | 'value'> {
		/** Accessible name of the PIN field. */
		label: string;
		/** The digits entered so far. */
		value?: string;
		maxLength?: number;
	}

	let {
		label,
		value = $bindable(''),
		maxLength = 6,
		disabled,
		...rest
	}: Props = $props();

	const id = $props.id();
	const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

	function press(digit: string) {
		if (value.length < maxLength) value += digit;
	}

	const keyClass =
		'flex h-[52px] items-center justify-center rounded-xl border border-border-subtle bg-surface-default font-display text-[22px] font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange active:bg-surface-accent-orange-subtle disabled:opacity-60';
</script>

<div class="flex flex-col gap-16">
	<label for={id} class="sr-only">{label}</label>
	<!-- A real input, so a hardware keyboard, paste and password managers work;
	     the keypad below just types into it. -->
	<input
		{...rest}
		{id}
		type="password"
		inputmode="numeric"
		autocomplete="off"
		pattern={'[0-9]{4,6}'}
		maxlength={maxLength}
		{disabled}
		bind:value
		oninput={(e) => {
			value = e.currentTarget.value.replace(/\D/g, '').slice(0, maxLength);
		}}
		class="h-[56px] w-full rounded-xl border border-border-orange bg-surface-default text-center font-display text-[28px] tracking-[0.5em] text-text-primary outline-none focus:ring-2 focus:ring-border-orange/30"
	/>
	<div class="grid grid-cols-3 gap-8">
		{#each digits as digit (digit)}
			<button
				type="button"
				class={keyClass}
				{disabled}
				onclick={() => press(digit)}
			>
				{digit}
			</button>
		{/each}
		<span aria-hidden="true"></span>
		<button type="button" class={keyClass} {disabled} onclick={() => press('0')}>
			0
		</button>
		<button
			type="button"
			class={keyClass}
			aria-label="Delete last digit"
			disabled={disabled || value.length === 0}
			onclick={() => (value = value.slice(0, -1))}
		>
			<span aria-hidden="true">⌫</span>
		</button>
	</div>
</div>
