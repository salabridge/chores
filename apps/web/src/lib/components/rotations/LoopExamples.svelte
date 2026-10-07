<script lang="ts">
	import { type LoopExample, scopeName } from '#lib/rotation-loops.js';
	import Badge from '../ui/Badge.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	interface Props {
		/** One per real loop (`loopExample()`), in page order. */
		examples: LoopExample[];
	}

	let { examples }: Props = $props();
</script>

<SurfaceCard
	title="Current Loop Examples"
	subtitle="These examples reflect your household's loops, with scope, exclusions, and assignment order made explicit."
>
	{#if examples.length === 0}
		<p class="text-[13px] text-text-secondary">
			Loops you create show up here with who's in and who's out.
		</p>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-12 p-0">
			{#each examples as example (example.choreId)}
				<li class="flex flex-col gap-8 rounded-[16px] bg-background-base p-16 text-[12px] text-text-secondary">
					<div class="flex items-center justify-between gap-8">
						<h3 class="font-display text-[13px] font-bold text-text-primary">{example.title}</h3>
						<Badge tone={example.scope === 'whole_household' ? 'shared' : 'reachable'}>
							{scopeName(example.scope)}
						</Badge>
					</div>
					<p>Eligible: {example.eligible || 'nobody'}</p>
					{#each example.excluded as excluded (excluded.name)}
						<p>Excluded: {excluded.name}{excluded.reason ? ` - ${excluded.reason}` : ''}</p>
					{/each}
					<p>Order: {example.order}</p>
				</li>
			{/each}
		</ul>
	{/if}
</SurfaceCard>
