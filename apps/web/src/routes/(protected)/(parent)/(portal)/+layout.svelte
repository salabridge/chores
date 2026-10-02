<script lang="ts">
	import ParentSidebar from '#lib/components/shell/ParentSidebar.svelte';
	import { page } from '$app/state';

	let { children, data } = $props();
</script>

<!-- Desktop parent shell (SB-45). Guarded in hooks.server.ts and +layout.server.ts. -->
<div class="flex min-h-dvh flex-col lg:flex-row">
	<ParentSidebar
		pathname={page.url.pathname}
		parentNames={data.parents.map((p) => p.name)}
	/>
	<main class="flex min-w-0 flex-1 flex-col gap-24 p-16 lg:p-40">
		{@render children()}
	</main>
</div>
