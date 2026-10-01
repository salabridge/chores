<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props
		extends Omit<HTMLButtonAttributes, 'class' | 'role' | 'children'> {
		/** Whether the switch is on. Bindable. */
		checked?: boolean;
	}

	let {
		checked = $bindable(false),
		onclick,
		type = 'button',
		...rest
	}: Props = $props();
</script>

<!-- Pass `aria-label` or `aria-labelledby` so the switch has an accessible name. -->
<button
	{...rest}
	{type}
	role="switch"
	aria-checked={checked}
	onclick={(event) => {
		checked = !checked;
		onclick?.(event);
	}}
	class={[
		'relative h-[20px] w-[36px] shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:cursor-not-allowed disabled:opacity-60',
		checked ? 'bg-accent-orange' : 'bg-border-subtle',
	]}
>
	<span
		aria-hidden="true"
		class={[
			'absolute top-[2px] left-[2px] size-[16px] rounded-full bg-surface-default shadow-sm transition-transform',
			checked && 'translate-x-[16px]',
		]}
	></span>
</button>
