import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useRewards } from "@/context/RewardsContext";
import {
  FIRST_STEP,
  nextStep,
  previousStep,
  shouldStartTutorial,
  stepHref,
} from "@/lib/tutorial";
import { completeTutorial, dismissTutorial } from "@/lib/tutorial-api";

export type TutorialState =
  // Nothing on screen.
  | { phase: "off" }
  // The card over the app. confirmingClose: the "turn it off?" question is
  // up. saving: Finish was pressed and its answer is awaited. saveFailed:
  // the last Finish did not reach the server; the card says so.
  | {
      phase: "running";
      step: number;
      confirmingClose: boolean;
      saving: boolean;
      saveFailed: boolean;
    }
  // "Enjoy the app!", after the tutorial was closed or finished.
  | { phase: "farewell" };

type TutorialContextType = {
  state: TutorialState;
  /** From step 1, on the Tasks page; also the replay from the settings. */
  start: () => void;
  next: () => void;
  back: () => void;
  /** Step 9's button: saves COMPLETED, and only then says goodbye. */
  finish: () => Promise<void>;
  /** The X (or Escape): asks first. */
  requestClose: () => void;
  cancelClose: () => void;
  /** "Turn off" confirmed: goes at once, saving in the background. */
  confirmClose: () => void;
  /** "Let's go": the end, and the held rewards may show. */
  closeFarewell: () => void;
};

const TutorialContext = createContext<TutorialContextType | undefined>(
  undefined,
);

const OFF: TutorialState = { phase: "off" };

const running = (step: number): TutorialState => ({
  phase: "running",
  step,
  confirmingClose: false,
  saving: false,
  saveFailed: false,
});

/*
 * The tutorial's state and behaviour; TutorialOverlay draws it. Mounted in
 * the logged-in layout, so it never shows on the login and sign-up screens.
 *
 * - Starts on its own once per session for an account that has neither
 *   skipped nor finished it (shouldStartTutorial).
 * - Every step opens its page, so nobody has to find it in a menu.
 * - From start to "Let's go" it holds the reward windows back: a badge
 *   earned meanwhile (Bright Start, or what a sync paid at login) waits in
 *   the queue and shows after the farewell, not over the tutorial.
 * - Finishing must reach the server, or the badge would be lost: a failure
 *   keeps step 9 with a retry. Turning it off must not keep anyone waiting:
 *   it closes at once, and a failed save only means the status may stay
 *   NOT_STARTED (the once-per-session guard keeps it from coming back now).
 */
export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user, token, refreshUser } = useAuth();
  const { report, hold } = useRewards();
  const [state, setState] = useState<TutorialState>(OFF);
  // The account the tutorial already started for in this session.
  const startedFor = useRef<string | null>(null);
  // Set at once, so a double press on Finish sends one request.
  const finishing = useRef(false);

  const start = useCallback(() => {
    setState(running(FIRST_STEP));
    router.navigate(stepHref(FIRST_STEP));
  }, []);

  useEffect(() => {
    if (!user || !shouldStartTutorial(user, startedFor.current)) return;
    startedFor.current = user.id;
    start();
  }, [user, start]);

  const active = state.phase !== "off";
  useEffect(() => (active ? hold() : undefined), [active, hold]);

  function moveTo(step: number) {
    setState(running(step));
    router.navigate(stepHref(step));
  }

  function next() {
    if (state.phase === "running") moveTo(nextStep(state.step));
  }

  function back() {
    if (state.phase === "running") moveTo(previousStep(state.step));
  }

  function setRunning(
    change: Partial<Extract<TutorialState, { phase: "running" }>>,
  ) {
    setState((current) =>
      current.phase === "running" ? { ...current, ...change } : current,
    );
  }

  function sayGoodbye() {
    setState({ phase: "farewell" });
    router.navigate("/");
  }

  async function finish() {
    if (finishing.current || !token) return;
    finishing.current = true;
    setRunning({ saving: true, saveFailed: false });
    try {
      const { badgesEarned } = await completeTutorial(token);
      // Still held: Bright Start waits in the queue until "Let's go". The
      // queue reads the user again itself; without a badge, read it here,
      // so the status is COMPLETED locally too.
      if (badgesEarned.length > 0) await report({ badgesEarned });
      else await refreshUser();
      sayGoodbye();
    } catch {
      setRunning({ saving: false, saveFailed: true });
    } finally {
      finishing.current = false;
    }
  }

  function confirmClose() {
    sayGoodbye();
    if (!token) return;
    dismissTutorial(token)
      .then(() => refreshUser())
      .catch(() => {
        // Not saved: the status may stay NOT_STARTED, and the tutorial
        // would come back at the next session's start. Not now, though:
        // startedFor already holds this account.
      });
  }

  return (
    <TutorialContext.Provider
      value={{
        state,
        start,
        next,
        back,
        finish,
        requestClose: () => setRunning({ confirmingClose: true }),
        cancelClose: () => setRunning({ confirmingClose: false }),
        confirmClose,
        closeFarewell: () => setState(OFF),
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial musi być użyty wewnątrz TutorialProvider");
  }
  return ctx;
}
