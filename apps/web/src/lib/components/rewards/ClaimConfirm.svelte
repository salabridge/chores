<script lang="ts">
	import type { Snippet } from 'svelte';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import SecondaryButton from '#lib/components/ui/SecondaryButton.svelte';

	interface Props {
		title: string;
		cost: number;
		/** The member's points before the claim. */
		balance: number;
		/** The claim is being sent: disables Confirm so it can't be sent twice. */
		pending?: boolean;
		/** Where Cancel goes (a link, so it works without JavaScript). */
		cancelHref: string;
		/** Hidden inputs the surrounding form posts, e.g. the reward id. */
		children?: Snippet;
	}

	let {
		title,
		cost,
		balance,
		pending = false,
		cancelHref,
		children,
	}: Props = $props();

	const headingId = $props.id();
	const left = $derived(balance - cost);
</script>

<!-- Rendered inside the page's <form method="POST" action="?/claim">. -->
<section
	aria-labelledby={headingId}
	class="flex flex-col gap-12 rounded-[16px] border-2 border-border-orange bg-surface-accent-orange-subtle p-16"
>
	{@render children?.()}
	<div class="flex flex-col gap-4">
		<h3
			id={headingId}
			class="font-display text-[16px] font-bold text-text-primary"
		>
			Claim {title}?
		</h3>
		<p class="text-[13px] text-text-secondary">
			This spends {cost} points. You have {balance} now and will have {left} left.
		</p>
	</div>
	<div class="flex gap-8">
		<SecondaryButton href={cancelHref} class="flex-1">Cancel</SecondaryButton>
		<PrimaryButton type="submit" {pending} class="flex-1">
			{pending ? 'Claiming…' : `Spend ${cost} points`}
		</PrimaryButton>
	</div>
</section>
