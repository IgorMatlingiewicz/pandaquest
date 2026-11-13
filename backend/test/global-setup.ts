import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { TEST_DATABASE, testDatabaseUrl } from './test-database';

/*
 * Runs once before all e2e tests: makes sure the test database exists and
 * has every migration applied, the hand-written SQL included. The tests then
 * run against the same schema as production, not one Prisma pushed.
 */
export default async function globalSetup() {
  const url = testDatabaseUrl();

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DATABASE],
    );
    if (!rowCount) await client.query(`CREATE DATABASE "${TEST_DATABASE}"`);
  } finally {
    await client.end();
  }

  // The Prisma CLI run by node itself: no shell, so nothing to escape, the
  // same on Windows and elsewhere.
  const backend = resolve(__dirname, '..');
  execFileSync(
    process.execPath,
    [
      resolve(backend, 'node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      'prisma7.config.ts',
    ],
    {
      cwd: backend,
      env: { ...process.env, DATABASE_URL: url },
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
}
