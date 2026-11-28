import {
  BASE_URL,
  EXTRA_TASKS_PER_USER,
  PASSWORD,
  TIMEZONE,
  USER_COUNT,
} from './config';

/*
 * Test data made through the API, as the app makes it, before any
 * measurement: an account made this way has everything a real one has
 * (example categories and tasks, a friend code, a timezone).
 */

export type PerfUser = {
  token: string;
  /** A DAILY yes/no task: completing it runs the whole completion path. */
  toggleTaskId: string;
};

type Category = { id: string; cycleType: 'DAILY' | 'WEEKLY' | 'LIFE' | null };
type Slot = 'DAILY' | 'WEEKLY' | 'LIFE' | 'OWN';

async function call<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    throw new Error(
      `${method} ${path}: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

/**
 * The extra tasks, the same for every account: spread over the three cycle
 * categories and one of the user's own, every third one with progress. The
 * first is the one the completion scenario toggles.
 */
function taskPlan() {
  const slots: Slot[] = ['DAILY', 'WEEKLY', 'LIFE', 'OWN'];
  return Array.from({ length: EXTRA_TASKS_PER_USER }, (_, i) => ({
    slot: slots[i % slots.length],
    title: i === 0 ? 'Zadanie do przełączania' : `Zadanie testowe ${i + 1}`,
    progress: i % 3 === 2,
  }));
}

async function seedUser(index: number): Promise<PerfUser> {
  const email = `perf-${String(index).padStart(2, '0')}@example.com`;
  await call('POST', '/auth/register', {
    body: {
      email,
      username: `perf${index}`,
      password: PASSWORD,
      timezone: TIMEZONE,
      language: 'pl',
    },
  });
  // Sign-up answers without a token; the app logs in right after, too.
  const { accessToken: token } = await call<{ accessToken: string }>(
    'POST',
    '/auth/login',
    { body: { email, password: PASSWORD, timezone: TIMEZONE } },
  );

  const categories = await call<Category[]>('GET', '/categories', { token });
  const own = await call<Category>('POST', '/categories', {
    token,
    body: { name: 'Własna' },
  });
  const categoryFor = (slot: Slot): string => {
    if (slot === 'OWN') return own.id;
    const found = categories.find((c) => c.cycleType === slot);
    if (!found) throw new Error(`Konto bez kategorii ${slot}`);
    return found.id;
  };

  const ids: string[] = [];
  for (const task of taskPlan()) {
    const created = await call<{ id: string }>('POST', '/tasks', {
      token,
      body: {
        title: task.title,
        categoryId: categoryFor(task.slot),
        ...(task.progress
          ? { completionMode: 'PROGRESS', progressTarget: 5 }
          : {}),
      },
    });
    ids.push(created.id);
  }
  const toggleTaskId = ids[0];

  // Completed once before measuring: the XP for this period is awarded now,
  // so every measured completion is a repeated one, in every run alike.
  // It also proves both requests of the scenario answer 200.
  const first = await call<{ xpAward: unknown }>(
    'PATCH',
    `/tasks/${toggleTaskId}`,
    { token, body: { status: 'COMPLETED' } },
  );
  if (first.xpAward === null) {
    throw new Error('Pierwsze ukończenie nie przyznało XP');
  }
  await call('PATCH', `/tasks/${toggleTaskId}`, {
    token,
    body: { status: 'ACTIVE' },
  });

  return { token, toggleTaskId };
}

/**
 * One account after another: sign-up and login hash passwords (argon2),
 * which is slow on purpose, and this is not what is being measured.
 */
export async function seedUsers(): Promise<{
  users: PerfUser[];
  tasksPerUser: number;
}> {
  const users: PerfUser[] = [];
  for (let i = 1; i <= USER_COUNT; i++) {
    users.push(await seedUser(i));
    process.stdout.write(`\r  konta: ${i}/${USER_COUNT}`);
  }
  process.stdout.write('\n');

  // Counted, not assumed: what GET /tasks really returns per account.
  const tasks = await call<unknown[]>('GET', '/tasks', {
    token: users[0].token,
  });
  return { users, tasksPerUser: tasks.length };
}
