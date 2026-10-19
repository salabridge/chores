<script lang="ts">
	import {
		favourBannerText,
		favourBannerTitle,
		recordBannerText,
	} from '#lib/favour.js';
	import Callout from '../ui/Callout.svelte';

	/**
	 * Shown on a chore that belongs to someone else (SB-75): "This is Leo's
	 * chore. Leo approves it, then you get the points." A parent in their own view picks who did
	 * it instead, so the banner points at the select.
	 */
	interface Props {
		/** Whose chore it is (the assignee, or the rotation's turn-holder). */
		ownerName: string;
		/** A parent records who did it, rather than doing it themselves. */
		recording?: boolean;
		class?: string;
	}

	let { ownerName, recording = false, class: className }: Props = $props();
</script>

<Callout tone="action" title={favourBannerTitle(ownerName)} class={className} data-testid="favour-banner">
	{recording ? recordBannerText : favourBannerText(ownerName)}
</Callout>
