// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionInfo, SessionUser } from '#lib/server/auth.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** The signed-in user, or `null`. Set in `hooks.server.ts`. */
			user: SessionUser | null;
			session: SessionInfo | null;
		}
		interface PageData {
			/** Set true from a route load to hide the mobile bottom tab nav. */
			hideNav?: boolean;
		}
		// interface PageState {}
		// interface Platform {}
	}
}
