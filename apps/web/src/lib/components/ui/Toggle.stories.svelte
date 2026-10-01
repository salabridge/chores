<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import Toggle from './Toggle.svelte';

	const { Story } = defineMeta({
		title: 'UI/Toggle',
		component: Toggle,
		tags: ['autodocs'],
		args: { 'aria-label': 'Include in rotation', onclick: fn() },
	});
</script>

<Story name="Off" />

<Story name="On" args={{ checked: true }} />

<Story name="Disabled" args={{ disabled: true }} />
