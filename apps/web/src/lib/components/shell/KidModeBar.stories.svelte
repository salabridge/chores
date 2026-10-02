<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import KidModeBar from './KidModeBar.svelte';

	// "Switch profile" opens ParentPinDialog; its remote forms are mocked in
	// .storybook/mocks.
	const { Story } = defineMeta({
		title: 'Shell/KidModeBar',
		component: KidModeBar,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { name: 'Mia', locked: false },
	});
</script>

<Story name="Default" />

<Story name="PIN locked" args={{ locked: true }} />

<Story name="Long name" args={{ name: 'Maximiliana Rosalind' }} />
