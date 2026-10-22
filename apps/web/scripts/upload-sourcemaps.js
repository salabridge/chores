// Uploads the browser build's source maps to PostHog error tracking (SB-89),
// so stack traces point at our source. Runs after `vite build`, and only when
// POSTHOG_CLI_API_KEY is set (Vercel production). `vite.config.ts` writes the
// maps only then too. The CLI tags each chunk with an id the SDK reports,
// uploads the maps, then deletes them so they're never served.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** adapter-vercel's copy of the client build: the files that are deployed. */
const CLIENT_DIR = '.vercel/output/static/_app/immutable';

if (!process.env.POSTHOG_CLI_API_KEY) {
	console.log('POSTHOG_CLI_API_KEY is unset; not uploading source maps.');
	process.exit(0);
}
if (!existsSync(CLIENT_DIR)) {
	console.error(`${CLIENT_DIR} is missing; run vite build first.`);
	process.exit(1);
}

const args = [
	'sourcemap',
	'process',
	'--directory',
	CLIENT_DIR,
	'--release-name',
	'chores-web',
	'--delete-after',
];
// Vercel's checkout may have no git history for the CLI to read the commit from.
if (process.env.VERCEL_GIT_COMMIT_SHA) {
	args.push('--release-version', process.env.VERCEL_GIT_COMMIT_SHA);
}

try {
	// The lockfile-pinned devDependency (`pnpm run` puts its bin on PATH), and
	// only the env it needs: the build env also holds DATABASE_URL,
	// NEON_AUTH_URL and RESEND_API_KEY.
	execFileSync('posthog-cli', args, {
		stdio: 'inherit',
		shell: process.platform === 'win32',
		env: {
			PATH: process.env.PATH,
			HOME: process.env.HOME,
			SystemRoot: process.env.SystemRoot,
			POSTHOG_CLI_API_KEY: process.env.POSTHOG_CLI_API_KEY,
			POSTHOG_CLI_PROJECT_ID: process.env.POSTHOG_CLI_PROJECT_ID,
			POSTHOG_CLI_HOST: process.env.POSTHOG_CLI_HOST,
		},
	});
} catch {
	// PostHog being down mustn't stop a deploy. Stack traces from this build
	// stay minified.
	console.warn('Source map upload failed; deleting the maps and carrying on.');
} finally {
	// Whatever the CLI did, no map is ever served: `--delete-after` is the
	// CLI's promise, this is ours.
	for (const file of readdirSync(CLIENT_DIR, { recursive: true })) {
		if (file.endsWith('.map')) rmSync(join(CLIENT_DIR, file));
	}
}
