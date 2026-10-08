<script lang="ts">
	import type { HTMLFieldsetAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLFieldsetAttributes, 'children'> {
		/** What's being moved, used in the button names ("Move Leo up"). */
		name: string;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		disabled?: boolean;
		onmove?: (direction: 'up' | 'down') => void;
	}

	let {
		name,
		canMoveUp = true,
		canMoveDown = true,
		disabled = false,
		onmove,
		class: className,
		...rest
	}: Props = $props();

	const button =
		'inline-flex size-[28px] items-center justify-center rounded-[8px] border border-border-subtle bg-surface-default text-text-secondary transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:cursor-not-allowed disabled:opacity-40';
</script>

<!-- The shared reorder control: Rotation Loops Builder (SB-50) and the Chore Creator's Eligibility panel (SB-49). -->
<fieldset {...rest} class={['m-0 flex min-w-0 items-center gap-4 border-0 p-0', className]}>
	<legend class="sr-only">Reorder {name}</legend>
	<button
		type="button"
		class={button}
		aria-label="Move {name} up"
		disabled={disabled || !canMoveUp}
		onclick={() => onmove?.('up')}
	>
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[14px]" aria-hidden="true">
			<path d="m4 10 4-4 4 4" />
		</svg>
	</button>
	<button
		type="button"
		class={button}
		aria-label="Move {name} down"
		disabled={disabled || !canMoveDown}
		onclick={() => onmove?.('down')}
	>
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[14px]" aria-hidden="true">
			<path d="m4 6 4 4 4-4" />
		</svg>
	</button>
</fieldset>
