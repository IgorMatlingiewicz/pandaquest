import {
  changePasswordFailure,
  createStreakGoalErrorKey,
  deleteCategoryErrorKey,
  friendFailure,
  friendsLoadErrorKey,
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

describe("friendsLoadErrorKey", () => {
  it.each([
    [401, "common.sessionExpired"],
    [404, "friends.loadError"],
    [500, "friends.loadError"],
  ])("maps %i to %s", (status, key) => {
    expect(friendsLoadErrorKey(status)).toBe(key);
  });
});

describe("friendFailure", () => {
  const NOW = Date.parse("2026-11-14T12:00:00.000Z");
  const refused = (status: number, body?: object) =>
    friendFailure(new HttpError(status, body), NOW, "pl");

  it.each([
    [404, "INVALID_FRIEND_CODE"],
    [400, "CANNOT_ADD_SELF"],
    [409, "ALREADY_FRIENDS"],
    [409, "REQUEST_ALREADY_SENT"],
    [409, "TOO_MANY_PENDING_REQUESTS"],
    [409, "FRIEND_LIMIT_REACHED"],
    [404, "REQUEST_NOT_FOUND"],
    [404, "FRIEND_NOT_FOUND"],
  ])("goes by the code, not the status: %i %s", (status, code) => {
    expect(refused(status, { code })).toEqual({
      key: `friends.errors.${code}`,
    });
  });

  it("tells a declined sender in how many days, and from when, to ask again", () => {
    expect(
      refused(409, {
        code: "FRIEND_REQUEST_COOLDOWN",
        availableAt: "2026-11-17T12:00:00.000Z",
      }),
    ).toEqual({
      key: "friends.errors.FRIEND_REQUEST_COOLDOWN",
      values: { count: 3, date: expect.stringContaining("17 lis 2026") },
    });
  });

  it("still says it was declined when the date is missing", () => {
    expect(refused(409, { code: "FRIEND_REQUEST_COOLDOWN" })).toEqual({
      key: "friends.errors.cooldownLater",
    });
  });

  it("reads the rate limit from the status, as it has no code", () => {
    expect(refused(429, { statusCode: 429, message: "Za dużo prób" })).toEqual({
      key: "friends.errors.tooManyAttempts",
    });
  });

  it("sends an ended session to the shared text", () => {
    expect(refused(401)).toEqual({ key: "common.sessionExpired" });
  });

  it.each([
    [409, "common.tryAgain"],
    [500, "common.genericError"],
    [503, "common.genericError"],
  ])("never shows a code this app does not know: %i is %s", (status, key) => {
    expect(refused(status, { code: "SOMETHING_NEW" })).toEqual({ key });
  });

  it("calls no answer at all a connection problem", () => {
    expect(
      friendFailure(new TypeError("Network request failed"), NOW, "pl"),
    ).toEqual({ key: "common.noConnection" });
  });
});
