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
	PUBLIC_POSTHOG_KEY: {
		public: true,
		schema: optional,
		description:
			'PostHog project API key (phc_…). Unset (local dev, e2e, previews) turns analytics off: the SDK never loads and nothing is sent.',
	},
	PUBLIC_POSTHOG_HOST: {
		public: true,
		// Unset means PostHog Cloud US; anything else must be a URL, normalized
		// to an origin.
		schema: type('string.url | undefined').pipe((v) =>
			v ? new URL(v).origin : 'https://us.i.posthog.com',
		),
		description:
			'PostHog ingestion host the /ingest proxy forwards to, e.g. https://us.i.posthog.com (the default).',
	},
});
