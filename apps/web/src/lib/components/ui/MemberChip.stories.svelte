<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MemberChip from './MemberChip.svelte';

	const { Story } = defineMeta({
		title: 'UI/MemberChip',
		component: MemberChip,
		tags: ['autodocs'],
		argTypes: {
			tone: { control: 'select', options: ['orange', 'blue', 'green', 'amber'] },
		},
		args: { name: 'Mia', tone: 'orange' },
	});
</script>

<Story name="Default" />

<Story name="All tones" asChild>
	<div class="flex flex-wrap gap-8">
		<MemberChip name="Mia" tone="orange" />
		<MemberChip name="Leo" tone="blue" />
		<MemberChip name="Ava" tone="green" />
		<MemberChip name="Sam" tone="amber" />
	</div>
</Story>
