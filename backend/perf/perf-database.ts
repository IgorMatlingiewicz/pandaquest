import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { Client } from 'pg';
import { BACKEND_DIR, PERF_DATABASE } from './config';

/*
 * The perf database lives in the same Postgres (docker-compose) as the dev
 * one, as pandaquest_test does for the e2e tests (test/test-database.ts).
 * Two guards keep the dev data safe: the name in the address, and the name
 * the server itself reports once connected.
 */

/** DATABASE_URL from backend/.env with the database name swapped. */
export function perfDatabaseUrl(): string {
  const env = parse(readFileSync(resolve(BACKEND_DIR, '.env')));
  if (!env.DATABASE_URL) {
    throw new Error('Brak DATABASE_URL w backend/.env');
  }
  const url = new URL(env.DATABASE_URL);
  url.pathname = `/${PERF_DATABASE}`;
  return url.toString();
}

function assertPerfUrl(url: string): void {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (name !== PERF_DATABASE) {
    throw new Error(`Odmowa: baza "${name}" to nie ${PERF_DATABASE}`);
  }
}

/** The same server's maintenance database, for CREATE and DROP DATABASE. */
function adminUrl(url: string): string {
  const admin = new URL(url);
  admin.pathname = '/postgres';
  return admin.toString();
}

async function withClient<T>(
  url: string,
  work: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Connects to the perf database and checks that it really is that one. */
function withPerfClient<T>(
  url: string,
  work: (client: Client) => Promise<T>,
): Promise<T> {
  assertPerfUrl(url);
  return withClient(url, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      'SELECT current_database() AS name',
    );
    if (rows[0].name !== PERF_DATABASE) {
      throw new Error(`Odmowa: baza "${rows[0].name}" to nie ${PERF_DATABASE}`);
    }
    return work(client);
  });
}

/**
 * Creates the database if needed, applies every migration and empties every
 * table, so each test run starts from the same state: no accounts left over
 * from the previous run.
 */
export async function preparePerfDatabase(url: string): Promise<void> {
  assertPerfUrl(url);

  await withClient(adminUrl(url), async (client) => {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [PERF_DATABASE],
    );
    if (!rowCount) await client.query(`CREATE DATABASE "${PERF_DATABASE}"`);
  });

  // The Prisma CLI run by node itself, as in test/global-setup.ts: no shell,
  // so nothing to escape, the same on Windows and elsewhere.
  execFileSync(
    process.execPath,
    [
      resolve(BACKEND_DIR, 'node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      'prisma7.config.ts',
    ],
    {
      cwd: BACKEND_DIR,
      env: { ...process.env, DATABASE_URL: url },
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );

  await withPerfClient(url, async (client) => {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    const list = rows.map(({ tablename }) => `"${tablename}"`).join(', ');
    if (list) await client.query(`TRUNCATE ${list} CASCADE`);
  });
}

/** The server's version as Postgres reports it, for the report. */
export function postgresVersion(url: string): Promise<string> {
  return withPerfClient(url, async (client) => {
    const { rows } = await client.query<{ server_version: string }>(
      'SHOW server_version',
    );
    return rows[0].server_version;
  });
}

/** --drop: removes the perf database; WITH (FORCE) ends its connections. */
export async function dropPerfDatabase(url: string): Promise<void> {
  assertPerfUrl(url);
  await withClient(adminUrl(url), (client) =>
    client.query(`DROP DATABASE IF EXISTS "${PERF_DATABASE}" WITH (FORCE)`),
  );
}
