import { defineEnvVars } from '@sveltejs/kit/env';
import { type } from 'arktype';

// Unset or empty means "not configured"; the code that reads these decides
// what to do without them.
const optional = type('string | undefined').pipe((v) => v || undefined);

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
			"The app's public origin, e.g. https://chores.example.com, for links that act as credentials (invites). Unset (local dev, e2e, previews) uses the request's origin and sends no invite email.",
	},
	RESEND_API_KEY: {
		public: false,
		schema: optional,
		description:
			'Resend API key for invite emails. Unset (local dev, e2e, previews) logs the link instead of sending.',
	},
	INVITE_EMAIL_FROM: {
		public: false,
		schema: optional,
		description:
			'From address for invite emails, on a domain verified in Resend, e.g. "ChoreLoop <invites@mail.example.com>".',
	},
});
