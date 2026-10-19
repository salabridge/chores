<script lang="ts">
	import HomeFeatures from './HomeFeatures.svelte';
	import HomeFooter from './HomeFooter.svelte';
	import HomeIntro from './HomeIntro.svelte';
	import SiteHeader from './SiteHeader.svelte';
</script>

<div class="min-h-dvh bg-background-base">
	<SiteHeader />
	<main>
		<HomeIntro />
		<HomeFeatures />
	</main>
	<HomeFooter />
</div>
