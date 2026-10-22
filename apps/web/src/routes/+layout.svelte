<script lang="ts">
	import './layout.css';
	import { identify, trackPageview } from '#lib/analytics.js';
	import { afterNavigate } from '$app/navigation';

	let { children, data } = $props();

	// Analytics (SB-85) runs in the browser only, and loads nothing without a
	// key; `hooks.client.ts` starts it. The effect and the navigation hook
	// below never run during SSR.
	$effect(() => {
		identify(data.analytics);
	});
	afterNavigate(({ to }) => {
		trackPageview(to?.route.id);
	});
</script>

{@render children()}
