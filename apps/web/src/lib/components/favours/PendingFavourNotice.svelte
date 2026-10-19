<script lang="ts">
	import {
		type FavourActions,
		type PendingFavour,
		pendingFavourRole,
		pendingFavourText,
		pendingFavourViewerText,
	} from '#lib/favour-approval.js';
	import { runFavourAction } from '#lib/favour-run.js';
	import Callout from '../ui/Callout.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';
	import FavourApprovalCard from './FavourApprovalCard.svelte';

	/**
	 * A chore's own screen while a favour on it waits for a decision (SB-80),
	 * in place of the complete button: the owner (or a parent) gets the
	 * approval card, the doer sees where it stands and can ask a parent, and
	 * anyone else follows along.
	 */
	interface Props {
		favour: PendingFavour;
		title: string;
		points: number;
		/** Whose chore it is. */
		ownerName: string | null;
		viewer: { id: string; isOwner: boolean; isParent: boolean };
		actions: FavourActions;
	}

	let { favour, title, points, ownerName, viewer, actions }: Props = $props();

	const role = $derived(pendingFavourRole(favour, viewer));

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function ask() {
		busy = true;
		error = null;
		error = await runFavourAction(() => actions.askParent(favour.completionId));
		busy = false;
	}
</script>

{#if role === 'decider'}
	<FavourApprovalCard
		item={{ completionId: favour.completionId, title, points, doneBy: favour.doneBy }}
		{actions}
	/>
{:else if role === 'doer'}
	<Callout
		tone="info"
		title={favour.escalated ? 'Waiting for a parent' : `Waiting for ${ownerName ?? 'the owner'}`}
		data-testid="pending-favour"
	>
		<div class="flex flex-col gap-8">
			<p>{pendingFavourText(points, favour.escalated ? 'a parent' : (ownerName ?? 'the owner'))}</p>
			{#if error}
				<p role="alert" class="text-[13px] text-text-orange">{error}</p>
			{/if}
			{#if !favour.escalated}
				<div>
					<SecondaryButton variant="tinted" tone="orange" pending={busy} onclick={ask}>
						Ask a parent
					</SecondaryButton>
				</div>
			{/if}
		</div>
	</Callout>
{:else}
	<Callout tone="info" title="Waiting for an OK" data-testid="pending-favour">
		{pendingFavourViewerText(favour, ownerName)}
	</Callout>
{/if}
