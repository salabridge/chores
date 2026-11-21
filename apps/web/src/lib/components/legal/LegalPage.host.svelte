<script lang="ts">
	import LegalPage from './LegalPage.svelte';

	let { title, lastUpdated }: { title: string; lastUpdated: string } = $props();
</script>

<LegalPage {title} {lastUpdated}>
	<h2>Section</h2>
	<p>Body text.</p>
</LegalPage>
