<script lang="ts" module>
	export type RotationMember = {
		name: string;
		tone?: 'orange' | 'blue' | 'green' | 'amber';
	};
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import Badge from './Badge.svelte';
	import MemberChip from './MemberChip.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
		/** Members in assignment order. */
		members: RotationMember[];
		/** Shows the summary chip, e.g. "Leo → Mia → loop reset", above the order. */
		showSummary?: boolean;
		/** Text of the closing green tag. */
		resetLabel?: string;
	}

	let {
		members,
		showSummary = false,
		resetLabel = 'Loop Reset',
		class: className,
		...rest
	}: Props = $props();

	const summary = $derived(
		[...members.map((m) => m.name), resetLabel.toLowerCase()].join(' → '),
	);
</script>

{#snippet arrow()}
	<svg
		viewBox="0 0 16 16"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="size-[16px] shrink-0 text-text-orange"
		data-arrow
		aria-hidden="true"
	>
		<path d="M3 8h10M9 4l4 4-4 4" />
	</svg>
{/snippet}

<div {...rest} class={['flex min-w-0 flex-col gap-8', className]}>
	{#if showSummary}
		<span
			data-summary
			class="w-fit max-w-full rounded-full bg-background-base px-8 py-4 text-[11px] font-medium text-text-secondary"
		>
			{summary}
		</span>
	{/if}
	<!-- Each item carries its leading arrow so a wrap never strands an arrow at a line end. -->
	<ol class="m-0 flex list-none flex-wrap items-center gap-x-8 gap-y-8 p-0">
		{#each members as member, i (i)}
			<li class="inline-flex items-center gap-8">
				{#if i > 0}{@render arrow()}{/if}
				<MemberChip name={member.name} tone={member.tone} />
			</li>
		{/each}
		<li class="inline-flex items-center gap-8" data-reset>
			{#if members.length > 0}{@render arrow()}{/if}
			<Badge tone="earned">{resetLabel}</Badge>
		</li>
	</ol>
</div>
