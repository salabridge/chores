import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { NEON_AUTH_URL } from '$app/env/public';
import { getRequestEvent } from '$app/server';
import { db } from './drizzle.js';

export const auth = betterAuth({
	// ... your config
	plugins: [sveltekitCookies(getRequestEvent)], // make sure this is the last plugin in the array
	baseURL: NEON_AUTH_URL,
	database: drizzleAdapter(db, {
		schemaName: 'neon_auth',
		provider: 'pg',
	}),
});
