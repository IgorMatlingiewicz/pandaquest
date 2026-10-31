import {
  deleteCategoryErrorKey,
  loginErrorKey,
  registerErrorKey,
} from "@/lib/api-errors";

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
