<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BottomNav from './BottomNav.svelte';

	const { Story } = defineMeta({
		title: 'Shell/BottomNav',
		component: BottomNav,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		argTypes: {
			pathname: {
				control: 'select',
				options: ['/today', '/rewards', '/streak', '/settings'],
			},
		},
		args: { pathname: '/today' },
	});
</script>

<Story name="Today" />

<Story name="Rewards" args={{ pathname: '/rewards' }} />

<Story name="Nested route" args={{ pathname: '/streak/history' }} />

<Story name="No active tab" args={{ pathname: '/settings' }} />
