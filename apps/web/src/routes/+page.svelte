<script lang="ts">
	import HomePage from '#lib/components/home/HomePage.svelte';

	const title = 'ChoreLoop · Everyday chores, a shared routine';
	const description =
		'Keep track of personal chores, take turns on household jobs, and make room for a few rewards along the way.';
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
</svelte:head>

<HomePage />
