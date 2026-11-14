import { act } from "@testing-library/react-native";

export type PendingRequest = {
  url: string;
  init: RequestInit | undefined;
  succeed: (body?: unknown, status?: number) => Promise<void>;
  // body: what the refusal says, e.g. { code } from the friends module.
  refuse: (status: number, body?: object) => Promise<void>;
  drop: () => Promise<void>;
};

/*
 * Stands in for the server. Every request waits until the test answers it,
 * so the test decides the order in which answers come back. Each request
 * keeps its address and options, for the hooks that send more than one.
 */
export function fakeServer() {
  const pending: PendingRequest[] = [];
  global.fetch = jest.fn(
    (url: string, init?: RequestInit) =>
      new Promise((resolve, reject) => {
        const settle = (fn: () => void) =>
          act(async () => {
            fn();
          });
        pending.push({
          url,
          init,
          succeed: (body, status = 200) =>
            settle(() =>
              resolve({
                ok: true,
                status,
                // A 204 has no body: reading one fails, as in a real fetch.
                json: async () => {
                  if (body === undefined) {
                    throw new SyntaxError("Unexpected end of JSON input");
                  }
                  return body;
                },
              }),
            ),
          refuse: (status, body = {}) =>
            settle(() =>
              resolve({ ok: false, status, json: async () => body }),
            ),
          drop: () =>
            settle(() => reject(new TypeError("Network request failed"))),
        });
      }),
  ) as unknown as typeof fetch;
  return pending;
}
