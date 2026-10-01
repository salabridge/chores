<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CodeInput from './CodeInput.svelte';

	const { Story } = defineMeta({
		title: 'Auth/CodeInput',
		component: CodeInput,
		tags: ['autodocs'],
		argTypes: {
			length: { control: { type: 'number', min: 4, max: 8 } },
		},
		args: { label: 'Verification code', name: 'code', length: 6 },
	});
</script>

<Story name="Empty" />

<Story name="Partially filled" args={{ value: '123' }} />

<Story name="Four digits" args={{ length: 4 }} />
