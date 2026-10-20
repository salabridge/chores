<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import logo from '#lib/assets/logo.svg';

	interface Props extends Omit<HTMLAnchorAttributes, 'href'> {
		/** Link target. Pass `null` to render without a link (e.g. already inside a link). */
		href?: string | null;
	}

	let { href = '/', class: className, ...rest }: Props = $props();
</script>

{#snippet content()}
	<img src={logo} alt="" width="36" height="36" class="size-[36px] shrink-0" />
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
