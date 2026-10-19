<script lang="ts">
	import {
		APPROVE_LABEL,
		DECLINE_LABEL,
		type FavourActions,
		type FavourItem,
		needsOkLead,
		needsOkPoints,
	} from '#lib/favour-approval.js';
	import { runFavourAction } from '#lib/favour-run.js';
	import Callout from '../ui/Callout.svelte';
	import PrimaryButton from '../ui/PrimaryButton.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';

	/**
	 * "Needs your OK" (SB-80): Mia says she did Leo's chore, and Leo says yes
	 * or no. Also used on a chore's own screen. The action reloads the data,
	 * which removes the card; a failure stays on it.
	 */
	interface Props {
		item: Pick<FavourItem, 'completionId' | 'title' | 'points' | 'doneBy'>;
		actions: Pick<FavourActions, 'approve' | 'decline'>;
		class?: string;
	}

	let { item, actions, class: className }: Props = $props();

	let busy = $state<'approve' | 'decline' | null>(null);
	let error = $state<string | null>(null);

	async function decide(kind: 'approve' | 'decline') {
		busy = kind;
		error = null;
		error = await runFavourAction(() => actions[kind](item.completionId));
		busy = null;
	}
</script>

<Callout tone="action" title="Needs your OK" class={className} data-testid="favour-approval">
	<div class="flex flex-col gap-12">
		<p class="text-[14px] text-text-primary">
			{needsOkLead(item.doneBy?.name ?? null)} <em class="font-semibold not-italic">{item.title}</em>.
			{needsOkPoints(item.points, item.doneBy?.name ?? null)}
		</p>
		{#if error}
			<p role="alert" class="text-[13px] text-text-orange">{error}</p>
		{/if}
		<div class="grid grid-cols-2 gap-8">
			<PrimaryButton
				pending={busy === 'approve'}
				disabled={busy !== null}
				onclick={() => decide('approve')}
			>
				{APPROVE_LABEL}
			</PrimaryButton>
			<SecondaryButton
				class="h-[50px] rounded-[14px]!"
				pending={busy === 'decline'}
				disabled={busy !== null}
				onclick={() => decide('decline')}
			>
				{DECLINE_LABEL}
			</SecondaryButton>
		</div>
	</div>
</Callout>
