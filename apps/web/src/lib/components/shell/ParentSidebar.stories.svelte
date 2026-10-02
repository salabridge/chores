<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ParentSidebar from './ParentSidebar.svelte';

	const { Story } = defineMeta({
		title: 'Shell/ParentSidebar',
		component: ParentSidebar,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { pathname: '/overview', parentNames: ['Mom', 'Dad'] },
	});
</script>

<Story name="Overview active" />

<Story name="Create & Assign active" args={{ pathname: '/chores/new' }} />

<Story name="Rotation Builder active" args={{ pathname: '/rotations' }} />

<Story name="Single parent" args={{ parentNames: ['Sam'] }} />
