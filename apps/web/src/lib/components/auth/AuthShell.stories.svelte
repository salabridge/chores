<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PrimaryButton from '../ui/PrimaryButton.svelte';
	import TextInput from '../ui/TextInput.svelte';
	import AuthHeading from './AuthHeading.svelte';
	import AuthShell from './AuthShell.svelte';

	const { Story } = defineMeta({
		title: 'Auth/AuthShell',
		component: AuthShell,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' },
		args: { pinFooter: true },
	});
</script>

{#snippet footer()}
	<p class="text-center text-[14px] text-text-secondary">
		New here? <a href="#signup" class="font-semibold text-text-orange">Create an account</a>
	</p>
{/snippet}

<Story name="Pinned footer" args={{ footer }}>
	{#snippet template({ children: _children, ...args })}
		<AuthShell {...args}>
			<AuthHeading title="Welcome back">Sign in to see today's chores.</AuthHeading>
			<TextInput label="Email" type="email" />
			<PrimaryButton>Continue</PrimaryButton>
		</AuthShell>
	{/snippet}
</Story>

<Story name="Inline footer" args={{ footer, pinFooter: false }}>
	{#snippet template({ children: _children, ...args })}
		<AuthShell {...args}>
			<AuthHeading title="Welcome back">Sign in to see today's chores.</AuthHeading>
			<TextInput label="Email" type="email" />
			<PrimaryButton>Continue</PrimaryButton>
		</AuthShell>
	{/snippet}
</Story>
