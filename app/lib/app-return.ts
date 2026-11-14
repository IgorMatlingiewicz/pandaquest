import { AppState, type AppStateStatus } from "react-native";

/*
 * The app coming back to the front: the user switched back from another
 * app, or, on the web, back to this browser tab (react-native-web reports
 * a hidden tab as "background"). A screen read only on focus misses what
 * changed meanwhile, as for the app nothing happened: the same screen was
 * on top before and after. Reading again on return is one request per
 * return, not polling: nothing runs on a timer.
 */

/**
 * Whether going from `previous` to `next` is a return to the front. iOS
 * passes through "inactive" (the control centre pulled down, a call), and
 * coming back from it counts too.
 */
export function isAppReturn(
  previous: AppStateStatus,
  next: AppStateStatus,
): boolean {
  return next === "active" && previous !== "active";
}

/** Calls `onReturn` on every return to the front; gives back the unsubscribe. */
export function onAppReturn(onReturn: () => void): () => void {
  let previous = AppState.currentState;
  const subscription = AppState.addEventListener("change", (next) => {
    if (isAppReturn(previous, next)) onReturn();
    previous = next;
  });
  // react-native-web gives no subscription where the page cannot tell.
  return () => subscription?.remove();
}
