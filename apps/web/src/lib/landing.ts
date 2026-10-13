// Where a signed-in user lands by default (SB-57), as plain data shared by the
// account setting, the server resolver and the tests. No server imports.

/** The screens a parent can pick. Mirrors the `landing_route` enum in `@chore/db`. */
export const LANDING_ROUTES = ['today', 'overview'] as const;
export type LandingRoute = (typeof LANDING_ROUTES)[number];

/** The only paths a stored preference can resolve to. Never a free-form value. */
export const LANDING_PATHS: Record<LandingRoute, string> = {
	today: '/today',
	overview: '/overview',
};

export const LANDING_LABELS: Record<LandingRoute, string> = {
	today: 'Today',
	overview: 'Parent dashboard',
};

export const DEFAULT_LANDING_ROUTE: LandingRoute = 'today';

export const isLandingRoute = (value: unknown): value is LandingRoute =>
	(LANDING_ROUTES as readonly unknown[]).includes(value);

/** The route in effect: this device's choice, else the user's default, else Today. */
export function effectiveLandingRoute(
	deviceRoute: LandingRoute | null | undefined,
	userDefault: LandingRoute | null | undefined,
): LandingRoute {
	return deviceRoute ?? userDefault ?? DEFAULT_LANDING_ROUTE;
}

export interface LandingContext {
	/** The user still has to go through first-run setup. */
	needsSetup: boolean;
	/** Who is acting: a kid profile on a parent's session, or the user themselves. */
	mode: 'self' | 'kid' | null;
	/** The signed-in user's own role, or null with no household. */
	role: 'owner' | 'parent' | 'kid' | null;
	deviceRoute?: LandingRoute | null;
	userDefault?: LandingRoute | null;
}

/**
 * The path a signed-in user lands on when nothing more specific was asked for.
 *
 * - Anyone who still needs setup goes to `/setup`, whatever they prefer.
 * - A kid profile on the device, or a user who isn't a parent, always gets
 *   Today. That matches the parent guard in `hooks.server.ts`, which would
 *   bounce them from the dashboard anyway.
 * - A parent gets their device's choice, else their default, else Today.
 */
export function resolveLandingPath(context: LandingContext): string {
	if (context.needsSetup) return '/setup';
	if (context.mode !== 'self') return LANDING_PATHS.today;
	if (context.role !== 'owner' && context.role !== 'parent') {
		return LANDING_PATHS.today;
	}
	return LANDING_PATHS[
		effectiveLandingRoute(context.deviceRoute, context.userDefault)
	];
}

/**
 * An explicit, already-safe redirect target wins over the preference. `/` is
 * what `safeRedirectTarget` returns for a missing or unsafe target, so it
 * means "no explicit target".
 */
export function landingTarget(redirectTo: string, landingPath: string): string {
	return redirectTo === '/' ? landingPath : redirectTo;
}
