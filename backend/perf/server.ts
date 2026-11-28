import { ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { BACKEND_DIR, BASE_URL, PORT } from './config';

const DIST_MAIN = resolve(BACKEND_DIR, 'dist/main.js');
const HEALTH_TIMEOUT_MS = 30_000;

export function assertBuilt(): void {
  if (!existsSync(DIST_MAIN)) {
    throw new Error('Brak dist/main.js: najpierw pnpm build');
  }
}

/**
 * Whatever already listens on the port (a forgotten server, another app)
 * would answer the test instead of the server started here.
 */
export async function assertPortFree(): Promise<void> {
  const taken = await new Promise<boolean>((done) => {
    const socket = connect({ host: '127.0.0.1', port: PORT });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
  if (taken) {
    throw new Error(`Port ${PORT} jest zajęty: zamknij to, co go używa`);
  }
}

/**
 * The built server, as `pnpm start:prod` runs it, but node itself and not
 * through pnpm or a shell: killing it then stops the server and not only a
 * wrapper. Its own variables win over backend/.env (dotenv never overrides
 * one already set), so only the address and port change; JWT_SECRET still
 * comes from .env, found as the server runs from the backend directory.
 */
export function startServer(databaseUrl: string): ChildProcess {
  return spawn(process.execPath, [DIST_MAIN], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl, PORT: String(PORT) },
    // Its errors are worth seeing; its start-up log is not.
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

/** Waits until GET /health answers 200: the server is up and has its database. */
export async function waitForHealth(server: ChildProcess): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Serwer zakończył się z kodem ${server.exitCode}`);
    }
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.status === 200) return;
    } catch {
      // Not listening yet.
    }
    await sleep(250);
  }
  throw new Error(
    `GET /health nie zwrócił 200 w ${HEALTH_TIMEOUT_MS / 1000} s`,
  );
}

export async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, 'exit');
  server.kill();
  await exited;
}
