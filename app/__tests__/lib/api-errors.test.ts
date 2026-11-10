import {
  changePasswordFailure,
  createStreakGoalErrorKey,
  deleteCategoryErrorKey,
  loginErrorKey,
  profileErrorKey,
  registerErrorKey,
  saveShowcaseErrorKey,
  statsErrorKey,
} from "@/lib/api-errors";
import { HttpError } from "@/lib/http-error";

describe("loginErrorKey", () => {
  it.each([400, 401])("blames the input for %i", (status) => {
    expect(loginErrorKey(status)).toBe("auth.login.invalidCredentials");
  });

  it.each([403, 404, 500, 503])("does not blame the input for %i", (status) => {
    expect(loginErrorKey(status)).toBe("common.genericError");
  });
});

describe("registerErrorKey", () => {
  it.each([
    [400, "auth.register.invalidData"],
    [409, "auth.register.emailTaken"],
    [422, "auth.register.failed"],
    [500, "common.genericError"],
    [503, "common.genericError"],
  ])("maps %i to %s", (status, key) => {
    expect(registerErrorKey(status)).toBe(key);
  });
});

describe("deleteCategoryErrorKey", () => {
  it.each([
    [403, "tasks.deleteCategoryForbidden"],
    [409, "tasks.deleteCategoryNotEmpty"],
    [500, "common.tryAgain"],
  ])("maps %i to %s", (status, key) => {
    expect(deleteCategoryErrorKey(status)).toBe(key);
  });
});

describe("statsErrorKey", () => {
  it.each([
    [401, "common.sessionExpired"],
    [404, "stats.loadError"],
    [500, "stats.loadError"],
  ])("maps %i to %s", (status, key) => {
    expect(statsErrorKey(status)).toBe(key);
  });
});

describe("createStreakGoalErrorKey", () => {
  it.each([
    [400, "streaks.invalidName"],
    [409, "streaks.limitReached"],
    [500, "common.tryAgain"],
  ])("maps %i to %s", (status, key) => {
    expect(createStreakGoalErrorKey(status)).toBe(key);
  });
});

describe("profileErrorKey", () => {
  it.each([
    [401, "common.sessionExpired"],
    [404, "profile.loadError"],
    [500, "profile.loadError"],
  ])("maps %i to %s", (status, key) => {
    expect(profileErrorKey(status)).toBe(key);
  });
});

describe("saveShowcaseErrorKey", () => {
  it.each([
    [400, "profile.showcase.invalid"],
    [404, "profile.showcase.notEarned"],
    [401, "common.sessionExpired"],
    [500, "common.tryAgain"],
  ])("maps %i to %s", (status, key) => {
    expect(saveShowcaseErrorKey(status)).toBe(key);
  });
});

describe("changePasswordFailure", () => {
  it.each([
    [403, "current", "profile.password.wrongCurrent"],
    [400, "next", "profile.password.tooWeak"],
    [409, "next", "profile.password.sameAsCurrent"],
    [401, "form", "common.sessionExpired"],
    [500, "form", "common.genericError"],
    [503, "form", "common.genericError"],
    [429, "form", "common.tryAgain"],
  ])("shows a %i at the %s field as %s", (status, field, key) => {
    expect(changePasswordFailure(new HttpError(status))).toEqual({
      field,
      key,
    });
  });

  it("calls no answer at all a connection problem", () => {
    expect(
      changePasswordFailure(new TypeError("Network request failed")),
    ).toEqual({ field: "form", key: "common.noConnection" });
  });

  it("never blames the current password for an ended session", () => {
    expect(changePasswordFailure(new HttpError(401)).field).not.toBe("current");
  });
});
