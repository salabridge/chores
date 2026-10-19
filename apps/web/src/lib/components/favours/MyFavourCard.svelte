<script lang="ts">
	import {
		ASK_PARENT_LABEL,
		type FavourActions,
		type FavourItem,
		myFavourState,
	} from '#lib/favour-approval.js';
	import { runFavourAction } from '#lib/favour-run.js';
	import Callout from '../ui/Callout.svelte';
	import SecondaryButton from '../ui/SecondaryButton.svelte';

	/**
	 * One favour the viewer did for someone else (SB-80): waiting for the
	 * owner, waiting for a parent, or decided. "Ask a parent" shows while the
	 * owner hasn't said yes (or after a decline), so a favour isn't stuck.
	 */
	interface Props {
		item: FavourItem;
		actions: Pick<FavourActions, 'askParent'>;
		class?: string;
	}

	let { item, actions, class: className }: Props = $props();

	const info = $derived(myFavourState(item));

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function ask() {
		busy = true;
		error = null;
		error = await runFavourAction(() => actions.askParent(item.completionId));
		busy = false;
	}
</script>

<Callout tone={info.tone} title={info.title} class={className} data-testid="my-favour" data-state={info.kind}>
	<div class="flex flex-col gap-8">
		<p class="text-[13px] font-semibold text-text-primary">{item.title}</p>
		<p>{info.text}</p>
		{#if error}
			<p role="alert" class="text-[13px] text-text-orange">{error}</p>
		{/if}
		{#if item.canAskParent}
			<div>
				<SecondaryButton
					variant="tinted"
					tone="orange"
					pending={busy}
					aria-label="{ASK_PARENT_LABEL} to decide {item.title}"
					onclick={ask}
				>
					{ASK_PARENT_LABEL}
				</SecondaryButton>
			</div>
		{/if}
	</div>
</Callout>
