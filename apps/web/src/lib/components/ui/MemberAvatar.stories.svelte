<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MemberAvatar from './MemberAvatar.svelte';

	const sizes = ['sm', 'md'] as const;
	const tones = ['orange', 'blue', 'green', 'amber'] as const;

	const { Story } = defineMeta({
		title: 'UI/MemberAvatar',
		component: MemberAvatar,
		tags: ['autodocs'],
		argTypes: {
			size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
			tone: { control: 'select', options: tones },
		},
		args: { name: 'Mia', size: 'md', tone: 'orange' },
	});
</script>

<Story name="Default" />

<Story name="Large active" args={{ size: 'lg', active: true }} />

<Story name="Large inactive" args={{ size: 'lg', active: false }} />

<Story name="Sizes and tones" asChild>
	<div class="flex flex-col gap-12">
		{#each sizes as size (size)}
			<div class="flex gap-8">
				{#each tones as tone (tone)}
					<MemberAvatar name="Sam" {size} {tone} />
				{/each}
			</div>
		{/each}
	</div>
</Story>
