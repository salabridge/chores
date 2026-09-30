<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import cpu from '#lib/assets/icons/cpu.svg';

	interface Props extends Omit<HTMLAnchorAttributes, 'href'> {
		/** Link target. Pass `null` to render without a link (e.g. already inside a link). */
		href?: string | null;
	}

	let { href = '/', class: className, ...rest }: Props = $props();
</script>

{#snippet content()}
	<span
		class="flex size-[36px] shrink-0 items-center justify-center rounded-[10px] bg-accent-orange"
	>
		<img src={cpu} alt="" width="20" height="20" />
	</span>
	<span class="font-display text-[18px] font-bold whitespace-nowrap text-text-primary"
		>ChoreLoop</span
	>
{/snippet}

{#if href === null}
	<span class={['flex w-fit items-center gap-8', className]}>
		{@render content()}
	</span>
{:else}
	<a
		{...rest}
		{href}
		aria-label="ChoreLoop home"
		class={['flex w-fit items-center gap-8', className]}
	>
		{@render content()}
	</a>
{/if}
