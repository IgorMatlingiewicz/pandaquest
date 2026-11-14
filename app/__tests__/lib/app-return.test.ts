import type { AppStateStatus } from "react-native";
import { isAppReturn, onAppReturn } from "@/lib/app-return";
import { fakeAppState } from "../hooks/fake-app-state";

describe("isAppReturn", () => {
  it.each([
    ["background", "active", true], // back from another app or browser tab
    ["inactive", "active", true], // iOS: back from the control centre
    ["active", "active", false], // nothing changed
    ["active", "background", false], // leaving is no return
    ["active", "inactive", false],
    ["background", "inactive", false], // still not on top
  ] as [AppStateStatus, AppStateStatus, boolean][])(
    "%s → %s is a return: %s",
    (previous, next, expected) => {
      expect(isAppReturn(previous, next)).toBe(expected);
    },
  );
});

describe("onAppReturn", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls back on each return, not on leaving or staying", async () => {
    const app = fakeAppState("active");
    const onReturn = jest.fn();
    onAppReturn(onReturn);

    await app.goTo("active");
    await app.goTo("background");
    expect(onReturn).not.toHaveBeenCalled();

    await app.goTo("active");
    expect(onReturn).toHaveBeenCalledTimes(1);

    await app.goTo("background");
    await app.goTo("active");
    expect(onReturn).toHaveBeenCalledTimes(2);
  });

  it("counts the first change from the background the app started in", async () => {
    const app = fakeAppState("background");
    const onReturn = jest.fn();
    onAppReturn(onReturn);

    await app.goTo("active");

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("stops listening once unsubscribed", async () => {
    const app = fakeAppState("active");
    const onReturn = jest.fn();
    const unsubscribe = onAppReturn(onReturn);

    unsubscribe();
    await app.goTo("background");
    await app.goTo("active");

    expect(onReturn).not.toHaveBeenCalled();
    expect(app.listening()).toBe(0);
  });
});
