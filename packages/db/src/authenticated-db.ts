import { Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose';
import * as schema from '../schema/schema.ts';

export type AuthenticatedTx = Parameters<
	Parameters<NeonDatabase<typeof schema>['transaction']>[0]
>[0];

export interface AuthenticatedDbOptions {
	/**
	 * Connection string for the `authenticated_backend` role
	 * (`DATABASE_AUTHENTICATED_URL`). Never pass the `neondb_owner` URL here:
	 * that role bypasses RLS.
	 */
	connectionString: string;
	/** The Neon Auth base URL (`NEON_AUTH_URL`), used to find the JWKS and issuer. */
	authUrl: string;
}

/**
 * A Drizzle client whose queries are subject to RLS for a signed-in user.
 *
 * `withAuth(token, fn)` verifies a Neon Auth JWT (from `authClient.token()` or
 * the `set-auth-jwt` header), then runs `fn` in a transaction with the verified
 * claims in `request.jwt.claims`, which is where `app.current_user_id()` reads
 * the user id from. The setting is transaction-local, so it can't leak into
 * another request's use of the pooled connection.
 */
export function createAuthenticatedDb({
	connectionString,
	authUrl,
}: AuthenticatedDbOptions) {
	const pool = new Pool({ connectionString });
	const db = drizzle({ client: pool, schema });
	const jwks = createRemoteJWKSet(
		new URL(`${authUrl.replace(/\/$/, '')}/.well-known/jwks.json`),
	);
	// Neon Auth issues tokens with the auth URL's origin as both iss and aud.
	const origin = new URL(authUrl).origin;

	async function verify(token: string): Promise<JWTPayload & { sub: string }> {
		const { payload } = await jwtVerify(token, jwks, {
			issuer: origin,
			audience: origin,
		});
		if (!payload.sub) throw new Error('JWT is missing the sub claim');
		return payload as JWTPayload & { sub: string };
	}

	async function withAuth<T>(
		token: string,
		fn: (tx: AuthenticatedTx) => Promise<T>,
	): Promise<T> {
		const claims = await verify(token);
		return db.transaction(async (tx) => {
			await tx.execute(
				sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`,
			);
			return fn(tx);
		});
	}

	return { withAuth, verify, close: () => pool.end() };
}

export * from './household-access.ts';
export * from './invites.ts';
export * from './rotations.ts';
