import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/svelte'; // make sure to import from better-auth/svelte
import { NEON_AUTH_URL } from '$app/env/public';

export const authClient = createAuthClient({
	baseURL: NEON_AUTH_URL,
	plugins: [emailOTPClient()],
	fetchOptions: {
		credentials: 'include',
	},
});
