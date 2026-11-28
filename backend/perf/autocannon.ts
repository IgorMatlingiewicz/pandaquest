import { readFileSync } from 'node:fs';
import autocannonUntyped from 'autocannon';

/*
 * autocannon ships no TypeScript types, and @types/autocannon would be one
 * more dependency. The types below describe only the part this test uses,
 * after autocannon's README (sections "API", "Results" and "Client API").
 */

export type AutocannonRequest = {
  method: 'GET' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  body?: string;
};

/** One per connection; setupClient gets it before the first request. */
export type AutocannonClient = {
  /** The requests this connection sends, over and over, in this order. */
  setRequests(requests: AutocannonRequest[]): void;
};

export type AutocannonOptions = {
  url: string;
  connections: number;
  /** In seconds. */
  duration: number;
  /** In seconds; a slower answer counts as a timeout. */
  timeout: number;
  setupClient: (client: AutocannonClient) => void;
};

/** hdr-histogram-percentiles-obj: for latency in ms, for requests per second. */
export type Histogram = {
  average: number;
  stddev: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p99: number;
};

export type AutocannonResult = {
  requests: Histogram & { total: number };
  latency: Histogram;
  /** Connection errors, timeouts included. */
  errors: number;
  timeouts: number;
  non2xx: number;
  statusCodeStats: Record<string, { count: number }>;
  /** In seconds. */
  duration: number;
  connections: number;
};

type Autocannon = (
  options: AutocannonOptions,
  done: (error: Error | null, result: AutocannonResult) => void,
) => unknown;

const autocannon = autocannonUntyped as Autocannon;

export function runAutocannon(
  options: AutocannonOptions,
): Promise<AutocannonResult> {
  return new Promise((resolve, reject) => {
    autocannon(options, (error, result) =>
      error ? reject(error) : resolve(result),
    );
  });
}

/** The installed version, read from the package itself, for the report. */
export function autocannonVersion(): string {
  const file = require.resolve('autocannon/package.json');
  const { version } = JSON.parse(readFileSync(file, 'utf8')) as {
    version: string;
  };
  return version;
}
