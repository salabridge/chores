import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Where a signed-in parent lands by default (SB-57). An enum, not a free-form
 * path, so a stored value can never become an open redirect. Add a value here
 * (and to `LANDING_PATHS` in apps/web/src/lib/landing.ts) to offer another
 * screen.
 */
export const landingRoute = pgEnum('landing_route', ['today', 'overview']);

export type LandingRoute = (typeof landingRoute.enumValues)[number];
