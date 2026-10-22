import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import { captureException, initAnalytics } from '#lib/analytics.js';
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from '$app/env/public';

// Analytics (SB-85) starts here rather than in the root layout, so an error in
// the first page's load is still reported. Without a key nothing loads.
export const init: ClientInit = () => {
	initAnalytics(PUBLIC_POSTHOG_KEY, PUBLIC_POSTHOG_HOST);
};

// Error tracking (SB-89). A 404 is a missing page, not a bug.
export const handleError: HandleClientError = ({ error, status }) => {
	if (status !== 404) captureException(error);
};
