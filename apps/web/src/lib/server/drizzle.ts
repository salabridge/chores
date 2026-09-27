import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { DATABASE_URL } from '$app/env/private';
import * as auth from './auth-schema.js';

const testTable = pgTable('testing', {
	id: uuid('id').primaryKey(),
	name: varchar('name').notNull(),
});

export const db = drizzle(DATABASE_URL, {
	schema: {
		testTable,
		...auth,
	},
});
