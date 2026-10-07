<script lang="ts">
	import Callout from '../ui/Callout.svelte';
	import SurfaceCard from '../ui/SurfaceCard.svelte';

	const steps = [
		{ dot: 'bg-accent-green', text: 'The current member completes the chore and marks it done.' },
		{ dot: 'bg-accent-orange', text: 'The reward is claimed and the turn is removed from the active queue.' },
		{ dot: 'bg-accent-blue', text: 'The next eligible member in the preview order becomes active immediately.' },
		{ dot: 'bg-accent-amber', text: 'Excluded members stay out of the loop until the rule or reason changes.' },
	];
</script>

<!-- The two static explainer cards from the Rotation Loops Builder (SB-50). -->
<SurfaceCard
	title="How Rotation Works"
	subtitle="Parents can rotate a shared chore across the whole household or an eligible subset, with reasons attached to every exclusion."
>
	<Callout tone="info">
		Choose Whole Household when every family member should rotate, or Eligible Subset when only
		some members should participate.
	</Callout>
	<Callout tone="success">
		The rotation advances immediately after the current turn is completed and claimed, so parents
		always know when the next assignment starts.
	</Callout>
	<Callout tone="warning">
		Exclusions stay attached to the loop with a reason, so safety rules and age-based limits are
		visible every time the rotation is reviewed.
	</Callout>
</SurfaceCard>

<SurfaceCard
	title="When the Rotation Advances"
	subtitle="Use this checklist to explain the handoff before saving or publishing the loop."
>
	<ul class="m-0 flex list-none flex-col gap-12 p-0">
		{#each steps as step (step.text)}
			<li class="flex items-start gap-8 text-[13px] text-text-secondary">
				<span class={['mt-6 size-[6px] shrink-0 rounded-full', step.dot]} aria-hidden="true"></span>
				<span>{step.text}</span>
			</li>
		{/each}
	</ul>
	<Callout tone="info">
		Previewing the assignment order before saving helps parents confirm the loop behaves correctly
		for both whole-household and subset rotations.
	</Callout>
</SurfaceCard>
