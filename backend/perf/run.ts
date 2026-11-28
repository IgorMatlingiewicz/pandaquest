import { setTimeout as sleep } from 'node:timers/promises';
import {
  CONNECTION_LEVELS,
  MEASURE_SECONDS,
  PAUSE_SECONDS,
  RUNS,
  WARMUP_SECONDS,
} from './config';
import {
  dropPerfDatabase,
  perfDatabaseUrl,
  preparePerfDatabase,
} from './perf-database';
import {
  describeEnvironment,
  Measurement,
  metricsOf,
  writeResults,
} from './report';
import { measure, SCENARIOS } from './scenarios';
import { seedUsers } from './seed';
import {
  assertBuilt,
  assertPortFree,
  startServer,
  stopServer,
  waitForHealth,
} from './server';

/*
 * The API performance test: `pnpm perf` (add --drop to remove the perf
 * database at the end). The server must be built first: `pnpm build`.
 */
async function main(): Promise<void> {
  const drop = process.argv.includes('--drop');
  const startedAt = new Date();
  const databaseUrl = perfDatabaseUrl();

  // The quick checks first, before anything is created.
  assertBuilt();
  await assertPortFree();

  console.log('Baza pandaquest_perf: zakładanie, migracje, czyszczenie...');
  await preparePerfDatabase(databaseUrl);

  console.log('Uruchamianie serwera (dist/main.js)...');
  const server = startServer(databaseUrl);
  // Ctrl+C would end this process but not the server it started.
  process.once('SIGINT', () => {
    server.kill();
    process.exit(130);
  });

  try {
    await waitForHealth(server);

    console.log('Dane testowe przez API (poza pomiarem):');
    const { users, tasksPerUser } = await seedUsers();
    console.log(`  ${users.length} kont, po ${tasksPerUser} zadań`);

    const measurements: Measurement[] = [];
    // Runs on the outside: every scenario is measured once per run, so a
    // slow drift of the machine (heat, background work) spreads over all of
    // them instead of falling on one.
    for (let run = 1; run <= RUNS; run++) {
      for (const scenario of SCENARIOS) {
        for (const connections of CONNECTION_LEVELS) {
          // Warm-up: JIT, caches and the database pool settle; thrown away.
          await measure(scenario, users, connections, WARMUP_SECONDS);
          const raw = await measure(
            scenario,
            users,
            connections,
            MEASURE_SECONDS,
          );
          const metrics = metricsOf(raw);
          measurements.push({
            run,
            scenario: scenario.id,
            connections,
            metrics,
            raw,
          });
          console.log(
            `[przebieg ${run}/${RUNS}] ${scenario.label}, ${connections} poł.: ` +
              `${metrics.requestsPerSecond.toFixed(1)} żądań/s, ` +
              `p99 ${metrics.latencyP99} ms, non2xx ${metrics.non2xx}, ` +
              `errors ${metrics.errors}`,
          );
          await sleep(PAUSE_SECONDS * 1000);
        }
      }
    }

    const environment = await describeEnvironment(databaseUrl);
    const files = writeResults(
      startedAt,
      environment,
      tasksPerUser,
      measurements,
    );
    console.log(`Wyniki:\n  ${files.md}\n  ${files.json}`);
  } finally {
    await stopServer(server);
  }

  if (drop) {
    await dropPerfDatabase(databaseUrl);
    console.log('Baza pandaquest_perf usunięta (--drop).');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
