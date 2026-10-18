import { defineEnvVars } from '@sveltejs/kit/env';
import { type } from 'arktype';

export const variables = defineEnvVars({
	DATABASE_URL: {
		public: false,
	},
	NEON_AUTH_URL: {
		public: false,
	},
	APP_ORIGIN: {
		public: false,
		// Unset or empty means "not configured"; normalized to an origin.
		schema: type('string | undefined').pipe((v) =>
			v ? new URL(v).origin : undefined,
		),
		description:
			"The app's public origin, e.g. https://chores.example.com, for links that act as credentials (invites). Unset (local dev, e2e, previews) uses the request's origin.",
	},
});
