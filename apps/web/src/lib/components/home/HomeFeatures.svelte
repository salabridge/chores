<script lang="ts">
	import giftIcon from '#lib/assets/icons/gift.svg';
	import listChecksIcon from '#lib/assets/icons/list-checks.svg';
	import repeatIcon from '#lib/assets/icons/repeat-2.svg';
	import FeatureCard from './FeatureCard.svelte';

	const features = [
		{
			icon: listChecksIcon,
			title: 'Personal chores',
			description:
				'A list for each person, with clear steps and a place to pick up where they left off.',
			example: 'Make your bed · Tidy your room',
		},
		{
			icon: repeatIcon,
			title: 'Shared rotations',
			description:
				'Take turns on the jobs you share, so everyone knows whose turn is next.',
			example: 'Wash the dishes · Feed the dog',
		},
		{
			icon: giftIcon,
			title: 'Points & rewards',
			description:
				'Earn points for completed chores and save up for rewards your family chooses.',
			example: 'Choose a movie · Pick a family outing',
		},
	];
</script>

<section class="flex flex-col gap-20 px-24 pb-[32px] lg:px-[120px] lg:pb-[40px]">
	<h2 class="font-display text-[22px] font-semibold text-text-primary lg:text-[24px]">
		A simple loop for the whole household
	</h2>
	<div class="grid grid-cols-1 gap-16 lg:grid-cols-3">
		{#each features as feature (feature.title)}
			<FeatureCard {...feature} />
		{/each}
	</div>
</section>
