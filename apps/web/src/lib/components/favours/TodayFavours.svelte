<script lang="ts">
	import type { FavourActions, MemberFavours } from '#lib/favour-approval.js';
	import FavourApprovalCard from './FavourApprovalCard.svelte';
	import MyFavourCard from './MyFavourCard.svelte';

	/**
	 * The favour cards at the top of Today (SB-80): what needs the viewer's
	 * OK, then the favours they did for others. Renders nothing when there is
	 * none of either.
	 */
	interface Props {
		favours: MemberFavours;
		actions: FavourActions;
	}

	let { favours, actions }: Props = $props();
</script>

{#if favours.toApprove.length > 0}
	<section class="min-w-0" aria-label="Needs your OK" data-testid="favours-to-approve">
		<ul class="flex flex-col gap-12 lg:grid lg:grid-cols-2">
			{#each favours.toApprove as item (item.completionId)}
				<li><FavourApprovalCard {item} {actions} /></li>
			{/each}
		</ul>
	</section>
{/if}

{#if favours.mine.length > 0}
	<section class="flex min-w-0 flex-col gap-12" aria-labelledby="my-favours" data-testid="my-favours">
		<h2 id="my-favours" class="font-display text-[17px] font-semibold text-text-primary lg:text-[20px]">
			Your favours
		</h2>
		<ul class="flex flex-col gap-12 lg:grid lg:grid-cols-2">
			{#each favours.mine as item (item.completionId)}
				<li><MyFavourCard {item} {actions} /></li>
			{/each}
		</ul>
	</section>
{/if}
