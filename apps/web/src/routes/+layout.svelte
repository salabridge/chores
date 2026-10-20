<script lang="ts">
	import './layout.css';
	import { identify, initAnalytics, trackPageview } from '#lib/analytics.js';
	import { browser } from '$app/env';
	import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from '$app/env/public';
	import { afterNavigate } from '$app/navigation';

	let { children, data } = $props();

	// Analytics (SB-85) runs in the browser only, and loads nothing without a
	// key. The effect and the navigation hook below never run during SSR.
	if (browser) initAnalytics(PUBLIC_POSTHOG_KEY, PUBLIC_POSTHOG_HOST);
	$effect(() => {
		identify(data.analytics);
	});
	afterNavigate(({ to }) => {
		trackPageview(to?.route.id);
	});
</script>

{@render children()}
