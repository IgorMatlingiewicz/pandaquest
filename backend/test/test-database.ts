import { config } from 'dotenv';
import { resolve } from 'node:path';

/** The database the e2e tests use: the dev server, another database. */
export const TEST_DATABASE = 'pandaquest_test';

/**
 * DATABASE_URL from backend/.env with the database name swapped, so the
 * tests reach the same Postgres (docker-compose) but never the dev data.
 */
export function testDatabaseUrl(): string {
  config({ path: resolve(__dirname, '../.env'), quiet: true });
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) throw new Error('DATABASE_URL is not set in backend/.env');
  const url = new URL(devUrl);
  url.pathname = `/${TEST_DATABASE}`;
  return url.toString();
}
