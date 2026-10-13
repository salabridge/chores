<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { noPasswordManager } from '#lib/shared-device.js';

	interface Props extends Omit<HTMLInputAttributes, 'class' | 'value'> {
		/** Visible label of the PIN field. */
		label: string;
		/** The digits entered so far. */
		value?: string;
		maxLength?: number;
		/** Shown under the input, e.g. a field's `issues()`. */
		issues?: { message: string }[];
	}

	let {
		label,
		value = $bindable(''),
		maxLength = 6,
		issues,
		...rest
	}: Props = $props();

	const id = $props.id();
</script>

<div class="flex flex-col gap-6">
	<label for={id} class="text-[14px] font-semibold text-text-secondary">
		{label}
	</label>
	<!-- A plain input, so the OS number pad, a hardware keyboard and paste
	     work. Password managers are opted out on purpose: this is a shared
	     device, and an autofilled PIN would let the kid leave their profile. -->
	<input
		{...rest}
		{...noPasswordManager}
		{id}
		type="password"
		inputmode="numeric"
		pattern={'[0-9]{4,6}'}
		maxlength={maxLength}
		aria-describedby={issues?.length ? `${id}-issues` : undefined}
		bind:value
		oninput={(e) => {
			value = e.currentTarget.value.replace(/\D/g, '').slice(0, maxLength);
		}}
		class="h-[56px] w-full rounded-xl border border-border-orange bg-surface-default text-center font-display text-[28px] tracking-[0.5em] text-text-primary outline-none focus:ring-2 focus:ring-border-orange/30 disabled:opacity-60"
	/>
	{#if issues?.length}
		<div id="{id}-issues" class="text-[13px] text-text-amber">
			{#each issues as issue}
				<p>{issue.message}</p>
			{/each}
		</div>
	{/if}
</div>
