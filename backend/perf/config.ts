import { resolve } from 'node:path';

/*
 * Every parameter of the performance test in one place: the report copies
 * them, so a reader knows exactly what was measured.
 */

/** The backend directory: the server runs from here, so it finds its .env. */
export const BACKEND_DIR = resolve(__dirname, '..');

/** The only database this test may touch; the dev data stays in the other. */
export const PERF_DATABASE = 'pandaquest_perf';

export const PORT = 3100;
// 127.0.0.1, not localhost: no name lookup, and no IPv6/IPv4 guessing.
export const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Test accounts: one per connection at the highest load level. */
export const USER_COUNT = 50;
/** Tasks each account gets on top of the 8 example tasks sign-up creates. */
export const EXTRA_TASKS_PER_USER = 20;
export const TIMEZONE = 'Europe/Warsaw';
export const PASSWORD = 'perf-test-password';

export const CONNECTION_LEVELS = [10, 50] as const;
export const WARMUP_SECONDS = 5;
export const MEASURE_SECONDS = 30;
export const RUNS = 3;
/** A pause after each measurement, so the next one starts from rest. */
export const PAUSE_SECONDS = 2;
/** autocannon's limit per request; a slower answer counts as a timeout. */
export const REQUEST_TIMEOUT_SECONDS = 10;
