<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
	import PrimaryButton from '../ui/PrimaryButton.svelte';
	import * as thisFile from './StickyActionBar.stories.svelte';
	import StickyActionBar from './StickyActionBar.svelte';

	const { Story } = defineMeta({
		title: 'Shell/StickyActionBar',
		component: StickyActionBar,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
	});
</script>

{#snippet summary()}
	<p class="text-[13px] text-text-secondary">
		Reward after all 3 stages · 15 pts
	</p>
{/snippet}

<Story name="With summary" args={{ summary }}>
	{#snippet template({ children: _children, ...args })}
		<StickyActionBar {...args}>
			<PrimaryButton>Create Chore</PrimaryButton>
		</StickyActionBar>
	{/snippet}
</Story>

<Story name="CTA only">
	{#snippet template({ children: _children, ...args })}
		<StickyActionBar {...args}>
			<PrimaryButton>Create Chore</PrimaryButton>
		</StickyActionBar>
	{/snippet}
</Story>

<Story
	name="Visual test"
	tags={['visual-test', '!autodocs']}
	parameters={visualTestParameters}
>
	{#snippet template(_args, context)}
		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
	{/snippet}
</Story>
