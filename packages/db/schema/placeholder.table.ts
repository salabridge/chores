import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const placeholder = pgTable('testing', {
	id: uuid('id').primaryKey(),
	name: varchar('name').notNull(),
});
