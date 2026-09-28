import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// Load env locally; in CI DATABASE_URL comes from the environment
if (existsSync('.env')) process.loadEnvFile('.env');

const DB_URL = process.env.DATABASE_URL || null;

if (DB_URL === null) process.exit(1);

// Export the config
export default defineConfig({
	dialect: 'postgresql',
	// Only the tables we own. auth-schema.ts mirrors Neon Auth's tables and must
	// never be migrated from here; FKs into it still generate from the references.
	schema: './schema/index.ts',
	out: './migrations',
	dbCredentials: {
		url: DB_URL,
	},
	schemaFilter: ['public'],
});
