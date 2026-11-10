import { createInstance } from "i18next";
import en from "@/i18n/locales/en";
import pl from "@/i18n/locales/pl";
import {
  changePasswordFailure,
  profileErrorKey,
  saveShowcaseErrorKey,
} from "@/lib/api-errors";
import { HttpError } from "@/lib/http-error";
import { validatePasswordForm } from "@/lib/profile";

describe("profile texts", () => {
  const i18n = createInstance();

  beforeAll(async () => {
    await i18n.init({
      lng: "pl",
      resources: { pl: { translation: pl }, en: { translation: en } },
    });
  });

  it.each([
    [0, 26, "Odznaki: 0 z 26"],
    [3, 26, "Odznaki: 3 z 26"],
    [26, 26, "Odznaki: 26 z 26"],
  ])("count %i of %i badges in Polish", (earned, total, text) => {
    expect(i18n.t("profile.badgeCount", { earned, total })).toBe(text);
  });

  it("count badges in English", () => {
    expect(
      i18n.getFixedT("en")("profile.badgeCount", { earned: 0, total: 26 }),
    ).toBe("Badges: 0 of 26");
  });

  // Every key the profile's functions can return has a text in both languages.
  const statuses = [400, 401, 403, 404, 409, 429, 500];
  const keys = new Set([
    ...statuses.map(profileErrorKey),
    ...statuses.map(saveShowcaseErrorKey),
    ...statuses.map(
      (status) => changePasswordFailure(new HttpError(status)).key,
    ),
    changePasswordFailure(new TypeError("offline")).key,
    ...Object.values(
      validatePasswordForm({ current: "", next: "", repeat: "" }),
    ),
    ...Object.values(
      validatePasswordForm({ current: "a", next: "b", repeat: "c" }),
    ),
  ]);

  it.each([...keys])("have %s in Polish and in English", (key) => {
    expect(i18n.exists(key, { lng: "pl" })).toBe(true);
    expect(i18n.exists(key, { lng: "en" })).toBe(true);
  });
});
