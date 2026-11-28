import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';
import { AutocannonResult, autocannonVersion } from './autocannon';
import {
  BACKEND_DIR,
  CONNECTION_LEVELS,
  EXTRA_TASKS_PER_USER,
  MEASURE_SECONDS,
  PAUSE_SECONDS,
  REQUEST_TIMEOUT_SECONDS,
  RUNS,
  TIMEZONE,
  USER_COUNT,
  WARMUP_SECONDS,
} from './config';
import { postgresVersion } from './perf-database';
import { SCENARIOS, Scenario } from './scenarios';

const RESULTS_DIR = resolve(BACKEND_DIR, 'perf/results');

/** The values the report keeps of one autocannon run. */
export type Metrics = {
  requestsPerSecond: number;
  latencyP50: number;
  latencyP90: number;
  latencyP99: number;
  latencyMax: number;
  non2xx: number;
  errors: number;
  timeouts: number;
};

export type Measurement = {
  run: number;
  scenario: Scenario['id'];
  connections: number;
  metrics: Metrics;
  /** autocannon's whole result, for whatever the table leaves out. */
  raw: AutocannonResult;
};

export type Environment = {
  cpu: string;
  physicalCores: number | null;
  logicalCores: number;
  ramGb: number;
  os: string;
  node: string;
  autocannon: string;
  postgres: string;
  note: string;
};

export function metricsOf(result: AutocannonResult): Metrics {
  return {
    requestsPerSecond: result.requests.average,
    latencyP50: result.latency.p50,
    latencyP90: result.latency.p90,
    latencyP99: result.latency.p99,
    latencyMax: result.latency.max,
    non2xx: result.non2xx,
    errors: result.errors,
    timeouts: result.timeouts,
  };
}

/** The middle value: one unusually fast or slow run does not move it. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Node reports logical cores only; Windows tells the physical count. */
function physicalCores(): number | null {
  if (process.platform !== 'win32') return null;
  try {
    const output = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        '(Get-CimInstance Win32_Processor | Measure-Object NumberOfCores -Sum).Sum',
      ],
      { encoding: 'utf8' },
    );
    const cores = Number(output.trim());
    return Number.isInteger(cores) && cores > 0 ? cores : null;
  } catch {
    return null;
  }
}

export async function describeEnvironment(
  databaseUrl: string,
): Promise<Environment> {
  return {
    cpu: os.cpus()[0]?.model.trim() ?? 'nieznany',
    physicalCores: physicalCores(),
    logicalCores: os.availableParallelism(),
    ramGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    os: `${os.version()} (${os.release()}, ${os.arch()})`,
    node: process.version,
    autocannon: autocannonVersion(),
    postgres: `PostgreSQL ${await postgresVersion(databaseUrl)} w kontenerze Docker (docker-compose.yml)`,
    note: 'Generator obciążenia (autocannon) i serwer działają na tym samym komputerze.',
  };
}

const PARAMETERS = {
  users: USER_COUNT,
  extraTasksPerUser: EXTRA_TASKS_PER_USER,
  timezone: TIMEZONE,
  connectionLevels: [...CONNECTION_LEVELS],
  warmupSeconds: WARMUP_SECONDS,
  measureSeconds: MEASURE_SECONDS,
  pauseSeconds: PAUSE_SECONDS,
  runs: RUNS,
  requestTimeoutSeconds: REQUEST_TIMEOUT_SECONDS,
};

type Row = {
  scenario: Scenario;
  connections: number;
  runs: Measurement[];
  median: Metrics;
};

function rows(measurements: Measurement[]): Row[] {
  return SCENARIOS.flatMap((scenario) =>
    CONNECTION_LEVELS.map((connections) => {
      const runs = measurements.filter(
        (m) => m.scenario === scenario.id && m.connections === connections,
      );
      const of = (key: keyof Metrics) =>
        median(runs.map((m) => m.metrics[key]));
      return {
        scenario,
        connections,
        runs,
        median: {
          requestsPerSecond: of('requestsPerSecond'),
          latencyP50: of('latencyP50'),
          latencyP90: of('latencyP90'),
          latencyP99: of('latencyP99'),
          latencyMax: of('latencyMax'),
          non2xx: of('non2xx'),
          errors: of('errors'),
          timeouts: of('timeouts'),
        },
      };
    }),
  );
}

const num = (value: number, digits = 1) =>
  Number.isInteger(value) ? String(value) : value.toFixed(digits);

function markdown(
  startedAt: Date,
  environment: Environment,
  tasksPerUser: number,
  table: Row[],
): string {
  const env = environment;
  const cores =
    env.physicalCores === null
      ? `${env.logicalCores} wątków logicznych`
      : `${env.physicalCores} rdzeni fizycznych, ${env.logicalCores} wątków logicznych`;

  const medians = table.map(
    (r) =>
      `| ${r.scenario.label} | ${r.connections} | ${num(r.median.requestsPerSecond)} | ` +
      `${num(r.median.latencyP50)} | ${num(r.median.latencyP90)} | ${num(r.median.latencyP99)} | ` +
      `${num(r.median.latencyMax)} | ${num(r.median.non2xx)} | ${num(r.median.errors)} | ${num(r.median.timeouts)} |`,
  );

  // Spread: (highest - lowest) / median of requests per second.
  const perRun = table.map((r) => {
    const values = r.runs.map((m) => m.metrics.requestsPerSecond);
    const spread =
      ((Math.max(...values) - Math.min(...values)) /
        r.median.requestsPerSecond) *
      100;
    return `| ${r.scenario.label} | ${r.connections} | ${values.map((v) => num(v)).join(' | ')} | ${num(spread)}% |`;
  });

  const runHeaders = Array.from(
    { length: RUNS },
    (_, i) => `Przebieg ${i + 1}`,
  );

  return [
    `# Test wydajności API PandaQuest`,
    '',
    `Start: ${startedAt.toLocaleString('pl-PL')}`,
    '',
    '## Parametry testu',
    '',
    `- Scenariusze: ${SCENARIOS.map((s) => s.label).join(', ')}. ` +
      'PATCH przełącza na zmianę ukończenie i odznaczenie własnego zadania DAILY (tak/nie).',
    `- Obciążenie: ${CONNECTION_LEVELS.join(' i ')} równoczesnych połączeń; każde połączenie to osobny użytkownik.`,
    `- Każdy pomiar: rozgrzewka ${WARMUP_SECONDS} s (odrzucona), pomiar ${MEASURE_SECONDS} s, przerwa ${PAUSE_SECONDS} s.`,
    `- ${RUNS} przebiegi; w każdym wszystkie scenariusze po kolei. W tabeli: mediana z ${RUNS} przebiegów.`,
    `- Dane: ${USER_COUNT} kont (strefa ${TIMEZONE}), po ${tasksPerUser} zadań ` +
      `(przykładowe z rejestracji + ${EXTRA_TASKS_PER_USER} dodanych).`,
    `- Limit czasu odpowiedzi: ${REQUEST_TIMEOUT_SECONDS} s.`,
    '',
    '## Środowisko',
    '',
    `- Procesor: ${env.cpu} (${cores})`,
    `- RAM: ${env.ramGb} GB`,
    `- System: ${env.os}`,
    `- Node.js: ${env.node}`,
    `- autocannon: ${env.autocannon}`,
    `- Baza: ${env.postgres}`,
    `- ${env.note}`,
    '',
    `## Wyniki (mediana z ${RUNS} przebiegów)`,
    '',
    '| Scenariusz | Połączenia | Żądania/s | p50 [ms] | p90 [ms] | p99 [ms] | max [ms] | non2xx | errors | timeouts |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...medians,
    '',
    '## Żądania/s w poszczególnych przebiegach',
    '',
    `| Scenariusz | Połączenia | ${runHeaders.join(' | ')} | Rozrzut |`,
    `|---|---:|${runHeaders.map(() => '---:').join('|')}|---:|`,
    ...perRun,
    '',
    'Rozrzut = (największa − najmniejsza wartość) / mediana.',
    '',
  ].join('\n');
}

/** 2026-11-28_14-05-33: sortable, and no colons, which Windows forbids. */
function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

export function writeResults(
  startedAt: Date,
  environment: Environment,
  tasksPerUser: number,
  measurements: Measurement[],
): { json: string; md: string } {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const base = resolve(RESULTS_DIR, stamp(startedAt));
  const table = rows(measurements);

  const json = `${base}.json`;
  writeFileSync(
    json,
    JSON.stringify(
      {
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        parameters: { ...PARAMETERS, tasksPerUser },
        environment,
        medians: table.map((r) => ({
          scenario: r.scenario.id,
          connections: r.connections,
          ...r.median,
        })),
        measurements,
      },
      null,
      2,
    ),
  );

  const md = `${base}.md`;
  writeFileSync(md, markdown(startedAt, environment, tasksPerUser, table));
  return { json, md };
}
