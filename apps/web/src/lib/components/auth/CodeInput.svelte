<script lang="ts">
	import { untrack } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'class'> {
		label: string;
		length?: number;
	}

	let { label, length = 6, value, ...rest }: Props = $props();

	const id = $props.id();
	// One real input (so paste and one-time-code autofill work) laid
	// transparently over the digit boxes, which just mirror its value.
	let code = $state(untrack(() => String(value ?? '')));
	let focused = $state(false);
	const active = $derived(focused ? Math.min(code.length, length - 1) : -1);
</script>

<label for={id} class="sr-only">{label}</label>
<div class="relative">
	<input
		{...rest}
		{id}
		value={code}
		maxlength={length}
		minlength={length}
		pattern={`\\d{${length}}`}
		inputmode="numeric"
		autocomplete="one-time-code"
		class="absolute inset-0 z-10 size-full bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
		oninput={(e) => {
			code = e.currentTarget.value.replace(/\D/g, '').slice(0, length);
			e.currentTarget.value = code;
		}}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
	/>
	<div class="flex gap-8" aria-hidden="true">
		{#each { length }, i}
			<div
				class={[
					'flex h-[58px] min-w-0 flex-1 items-center justify-center rounded-xl border-border-orange font-display text-[22px] font-bold',
					i === active
						? 'border-2 bg-surface-default'
						: 'border bg-surface-accent-orange-subtle',
				]}
			>
				{#if code[i]}
					{code[i]}
				{:else if i === active}
					<span class="h-[20px] w-[2px] animate-pulse bg-accent-orange"></span>
				{/if}
			</div>
		{/each}
	</div>
</div>
