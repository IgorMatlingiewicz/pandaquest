import {
  AutocannonRequest,
  AutocannonResult,
  runAutocannon,
} from './autocannon';
import { BASE_URL, REQUEST_TIMEOUT_SECONDS } from './config';
import type { PerfUser } from './seed';

export type Scenario = {
  id: 'health' | 'tasks' | 'stats' | 'complete';
  label: string;
  /** What one connection, acting as `user`, sends over and over. */
  requests: (user: PerfUser) => AutocannonRequest[];
};

const auth = (user: PerfUser) => ({ Authorization: `Bearer ${user.token}` });

function setStatus(
  user: PerfUser,
  status: 'COMPLETED' | 'ACTIVE',
): AutocannonRequest {
  return {
    method: 'PATCH',
    path: `/tasks/${user.toggleTaskId}`,
    headers: { ...auth(user), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  };
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'health',
    label: 'GET /health',
    requests: () => [{ method: 'GET', path: '/health' }],
  },
  {
    id: 'tasks',
    label: 'GET /tasks',
    requests: (user) => [
      { method: 'GET', path: '/tasks', headers: auth(user) },
    ],
  },
  {
    id: 'stats',
    label: 'GET /stats',
    requests: (user) => [
      { method: 'GET', path: '/stats', headers: auth(user) },
    ],
  },
  {
    id: 'complete',
    label: 'PATCH /tasks/:id',
    // Two requests in turn: complete, then uncheck, then complete again.
    requests: (user) => [
      setStatus(user, 'COMPLETED'),
      setStatus(user, 'ACTIVE'),
    ],
  },
];

/**
 * One autocannon run. Each connection takes the next account, so no two
 * connections share a user: a user's completions wait for each other (the
 * user row lock), and sharing would measure that queue, not the server.
 */
export function measure(
  scenario: Scenario,
  users: PerfUser[],
  connections: number,
  seconds: number,
): Promise<AutocannonResult> {
  if (connections > users.length) {
    throw new Error(`${connections} połączeń, a tylko ${users.length} kont`);
  }
  let next = 0;
  return runAutocannon({
    url: BASE_URL,
    connections,
    duration: seconds,
    timeout: REQUEST_TIMEOUT_SECONDS,
    setupClient: (client) =>
      client.setRequests(scenario.requests(users[next++])),
  });
}
