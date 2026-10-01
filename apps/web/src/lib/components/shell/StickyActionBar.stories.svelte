<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PrimaryButton from '../ui/PrimaryButton.svelte';
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
