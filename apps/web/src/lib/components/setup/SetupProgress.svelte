<script lang="ts">
	import { SETUP_STEPS, type SetupStep, STEP_LABELS } from '#lib/setup.js';

	let { current }: { current: SetupStep } = $props();

	const currentIndex = $derived(SETUP_STEPS.indexOf(current));
</script>

<nav aria-label="Setup progress">
	<p class="pb-8 text-[13px] font-semibold text-text-secondary">
		Step {currentIndex + 1} of {SETUP_STEPS.length}: {STEP_LABELS[current]}
	</p>
	<ol class="flex gap-6">
		{#each SETUP_STEPS as step, i (step)}
			<li
				aria-current={step === current ? 'step' : undefined}
				class={[
					'h-[6px] flex-1 rounded-full',
					i <= currentIndex ? 'bg-accent-orange' : 'bg-border-subtle',
				]}
			>
				<span class="sr-only">
					{STEP_LABELS[step]}{i < currentIndex ? ' (done)' : ''}
				</span>
			</li>
		{/each}
	</ol>
</nav>
