<script lang="ts">
	import OptionCard from './OptionCard.svelte';
	import OptionCardGroup from './OptionCardGroup.svelte';

	let {
		value = $bindable(),
		accent,
	}: { value?: string; accent?: 'orange' | 'blue' } = $props();
</script>

<OptionCardGroup label="Chore type" bind:value {accent}>
	<OptionCard value="personal" label="Personal Chore" />
	<OptionCard value="shared" label="Household Rotation" />
	<OptionCard value="other" label="Other" disabled />
</OptionCardGroup>
<output data-testid="value">{value ?? ''}</output>
