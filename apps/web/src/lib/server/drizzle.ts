import * as schema from '@chore/db';
import { drizzle } from 'drizzle-orm/neon-http';
import { DATABASE_URL } from '$app/env/private';

export const db = drizzle(DATABASE_URL, { schema });
