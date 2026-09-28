import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		public: false,
	},
	NEON_AUTH_URL: {
		public: false,
	},
});
