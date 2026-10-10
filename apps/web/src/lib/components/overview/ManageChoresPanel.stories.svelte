<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ManageChoresPanel from './ManageChoresPanel.svelte';

	const { Story } = defineMeta({
		title: 'Overview/ManageChoresPanel',
		component: ManageChoresPanel,
		tags: ['autodocs'],
		args: { createHref: '#create', rotationsHref: '#rotations', overviewHref: '#overview' },
	});
</script>

<Story name="Default" />
