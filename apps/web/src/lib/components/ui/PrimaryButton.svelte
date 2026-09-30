<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		HTMLAnchorAttributes,
		HTMLButtonAttributes,
	} from 'svelte/elements';

	type BaseProps = {
		children: Snippet;
		/** Disables the button and marks it busy, e.g. while a form is submitting. */
		pending?: boolean;
	};

	type ButtonProps = BaseProps &
		HTMLButtonAttributes & {
			href?: undefined;
		};

	type AnchorProps = BaseProps &
		Omit<HTMLAnchorAttributes, 'children'> & {
			href: string;
		};

	type Props = ButtonProps | AnchorProps;

	let {
		children,
		pending = false,
		class: className,
		...rest
	}: Props = $props();

	const classes = $derived([
		'flex h-[50px] w-full items-center justify-center rounded-[14px] bg-accent-orange text-[16px] font-semibold text-text-default transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-orange disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60',
		className,
	]);
</script>

{#if rest.href !== undefined}
	{@const { href, ...anchorRest } = rest as Omit<AnchorProps, keyof BaseProps | 'class'>}
	<a
		{...anchorRest}
		{href}
		class={classes}
		aria-busy={pending}
		aria-disabled={pending || undefined}
		tabindex={pending ? -1 : anchorRest.tabindex}
	>
		{@render children()}
	</a>
{:else}
	{@const { type = 'button', ...buttonRest } = rest as Omit<ButtonProps, keyof BaseProps | 'class'>}
	<button
		{...buttonRest}
		{type}
		class={classes}
		disabled={pending || buttonRest.disabled}
		aria-busy={pending}
	>
		{@render children()}
	</button>
{/if}
