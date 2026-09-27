import { defineConfig } from 'drizzle-kit';

// Load env
process.loadEnvFile('.env');

const DB_URL = process.env.DATABASE_URL || null;

if (DB_URL === null) process.exit(1);

// Export the config
export default defineConfig({
	dialect: 'postgresql',
	schema: './schema/schema.ts',
	dbCredentials: {
		url: DB_URL,
	},
	schemaFilter: ['public'],
});
