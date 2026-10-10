<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RotationLoopVisual from './RotationLoopVisual.svelte';

	const { Story } = defineMeta({
		title: 'UI/RotationLoopVisual',
		component: RotationLoopVisual,
		tags: ['autodocs'],
		args: { doneLast: 'Leo', active: 'Mia', nextUp: 'Sam' },
	});
</script>

<Story name="Default" />

<Story name="Two members" args={{ doneLast: 'Leo', active: 'Mia', nextUp: 'Leo' }} />

<Story
	name="Long names"
	args={{
		doneLast: 'Maximilian',
		active: 'Anastasia',
		nextUp: 'Bartholomew',
	}}
>
	{#snippet template(args)}
		<div class="max-w-[320px]">
			<RotationLoopVisual {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Nobody done yet" args={{ doneLast: null, active: 'Leo', nextUp: 'Mia' }} />
