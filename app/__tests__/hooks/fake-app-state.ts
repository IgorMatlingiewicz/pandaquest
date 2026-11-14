import { act } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

type Listener = (state: AppStateStatus) => void;

/*
 * Stands in for the system telling the app it went to the background and
 * came back (on the web: the browser tab hidden and shown again). React
 * Native's Jest setup gives AppState as plain mocks; this keeps the
 * listeners, so a test can move the app and count who still listens.
 */
export function fakeAppState(initial: AppStateStatus = "active") {
  const listeners = new Set<Listener>();
  (AppState as unknown as { currentState: AppStateStatus }).currentState =
    initial;
  jest
    .mocked(AppState.addEventListener)
    .mockImplementation((_type, listener) => {
      listeners.add(listener as Listener);
      return {
        remove: () => listeners.delete(listener as Listener),
      } as never;
    });

  return {
    /** How many listeners are subscribed now. */
    listening: () => listeners.size,
    /** Moves the app to `state`, telling every listener. */
    goTo: (state: AppStateStatus) =>
      act(async () => {
        listeners.forEach((listener) => listener(state));
      }),
  };
}
