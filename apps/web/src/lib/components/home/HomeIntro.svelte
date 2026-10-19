<script lang="ts">
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
</script>

<section
	class="flex flex-col items-center gap-24 px-24 pt-[40px] pb-[36px] lg:pt-[56px] lg:pb-[48px]"
>
	<div class="flex w-full flex-col items-center gap-16 text-center lg:w-[640px]">
		<h1
			class="font-display text-[36px] leading-[1.1] font-semibold text-text-primary lg:text-[52px]"
		>
			Everyday chores.<br />A shared routine.
		</h1>
		<p class="text-[16px] leading-[1.5] text-text-secondary lg:text-[18px]">
			Keep track of personal chores, take turns on household jobs, and make room
			for a few rewards along the way.
		</p>
	</div>
	<div class="flex w-full flex-col items-center gap-12 lg:w-[230px]">
		<PrimaryButton href="/signup">Get started</PrimaryButton>
		<p class="text-[13px] text-text-secondary">
			New here? Start with your household.
		</p>
	</div>
</section>
