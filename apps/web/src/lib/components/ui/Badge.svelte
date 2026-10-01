<script lang="ts" module>
	export type BadgeTone =
		| 'in-progress'
		| 'todo'
		| 'my-turn'
		| 'completed'
		| 'active-turn'
		| 'staged'
		| 'claimed'
		| 'personal'
		| 'shared'
		| 'earned'
		| 'reachable'
		| 'this-week'
		| 'required'
		| 'optional';

	type ToneStyle = {
		label: string;
		classes: string;
		/** Section tags are fully rounded; status pills use a tighter radius. */
		round?: boolean;
		dot?: string;
	};

	export const badgeTones: Record<BadgeTone, ToneStyle> = {
		'in-progress': {
			label: 'In Progress',
			classes: 'bg-surface-accent-amber-subtle text-text-amber font-semibold',
		},
		todo: {
			label: 'Todo',
			classes: 'bg-background-base text-text-secondary font-semibold',
		},
		'my-turn': {
			label: 'My Turn',
			classes: 'bg-accent-blue text-text-default font-bold',
		},
		completed: {
			label: 'Completed',
			classes: 'bg-surface-accent-green-subtle text-text-green font-semibold',
		},
		'active-turn': {
			label: 'Active Turn',
			classes: 'bg-accent-blue text-text-default font-bold',
		},
		staged: {
			label: 'Staged',
			classes:
				'bg-surface-accent-amber-subtle text-text-amber border border-border-amber font-semibold',
		},
		claimed: {
			label: 'Claimed',
			classes:
				'bg-surface-accent-orange-subtle text-text-orange border border-border-orange font-semibold',
		},
		personal: {
			label: 'Personal',
			classes: 'bg-surface-accent-orange-subtle text-text-orange font-bold',
			round: true,
			dot: 'bg-accent-orange',
		},
		shared: {
			label: 'Shared',
			classes: 'bg-surface-accent-blue-subtle text-text-blue font-bold',
			round: true,
			dot: 'bg-accent-blue',
		},
		earned: {
			label: 'Earned',
			classes: 'bg-surface-accent-green-subtle text-text-green font-bold',
			round: true,
		},
		reachable: {
			label: 'Reachable',
			classes: 'bg-surface-accent-blue-subtle text-text-blue font-bold',
			round: true,
		},
		'this-week': {
			label: 'This Week',
			classes: 'bg-surface-accent-amber-subtle text-text-amber font-bold',
			round: true,
		},
		required: {
			label: 'Required',
			classes: 'bg-surface-accent-orange-subtle text-text-orange font-bold',
			round: true,
		},
		optional: {
			label: 'Optional',
			classes: 'bg-background-base text-text-secondary font-bold',
			round: true,
		},
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
		tone: BadgeTone;
		/** Overrides the default label for the tone. */
		children?: Snippet;
	}

	let { tone, children, class: className, ...rest }: Props = $props();

	const style = $derived(badgeTones[tone]);
</script>

<span
	{...rest}
	data-tone={tone}
	class={[
		'inline-flex w-fit items-center gap-6 px-8 py-4 text-[11px] leading-none whitespace-nowrap',
		style.round ? 'rounded-full' : 'rounded-[8px]',
		style.classes,
		className,
	]}
>
	{#if style.dot}
		<span class={['size-[6px] shrink-0 rounded-full', style.dot]} aria-hidden="true"></span>
	{/if}
	{#if children}{@render children()}{:else}{style.label}{/if}
</span>
