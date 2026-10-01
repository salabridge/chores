<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PointsPill from './PointsPill.svelte';

	const { Story } = defineMeta({
		title: 'UI/PointsPill',
		component: PointsPill,
		tags: ['autodocs'],
		argTypes: {
			variant: { control: 'inline-radio', options: ['inline', 'header'] },
		},
		args: { points: 15, variant: 'inline' },
	});
</script>

<Story name="Inline" />

<Story name="Header" args={{ variant: 'header', points: 240 }} />
