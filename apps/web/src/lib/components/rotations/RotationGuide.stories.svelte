<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RotationGuide from './RotationGuide.svelte';

	const { Story } = defineMeta({
		title: 'Rotations/RotationGuide',
		component: RotationGuide,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
	});
</script>

<Story name="Default">
	{#snippet template()}
		<div class="flex max-w-[340px] flex-col gap-24">
			<RotationGuide />
		</div>
	{/snippet}
</Story>
