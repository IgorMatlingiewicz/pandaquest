import { createInstance } from "i18next";
import en from "@/i18n/locales/en";
import pl from "@/i18n/locales/pl";
import { friendFailure, friendsLoadErrorKey } from "@/lib/api-errors";
import { resendValues, sentRequestKey } from "@/lib/friends";
import { HttpError } from "@/lib/http-error";

describe("friends texts", () => {
  const i18n = createInstance();
  const NOW = Date.parse("2026-11-14T12:00:00.000Z");
  const day = (n: number) =>
    new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    await i18n.init({
      lng: "pl",
      resources: { pl: { translation: pl }, en: { translation: en } },
    });
  });

  it.each([
    [1, "za 1 dzień"],
    [3, "za 3 dni"],
    [7, "za 7 dni"],
  ])("count %i days of a cooldown in Polish", (days, words) => {
    const text = i18n.t(
      "friends.errors.FRIEND_REQUEST_COOLDOWN",
      resendValues(day(days), NOW, "pl"),
    );

    expect(text).toContain(words);
    expect(text).not.toContain("{{");
  });

  it.each([
    [1, "in 1 day"],
    [7, "in 7 days"],
  ])("count %i days of a cooldown in English", (days, words) => {
    expect(
      i18n.getFixedT("en")(
        "friends.requests.declinedUntil",
        resendValues(day(days), NOW, "en"),
      ),
    ).toContain(words);
  });

  // Every key the friends functions can return has a text in both languages.
  const codes = [
    "INVALID_FRIEND_CODE",
    "CANNOT_ADD_SELF",
    "ALREADY_FRIENDS",
    "REQUEST_ALREADY_SENT",
    "FRIEND_REQUEST_COOLDOWN",
    "TOO_MANY_PENDING_REQUESTS",
    "FRIEND_LIMIT_REACHED",
    "REQUEST_NOT_FOUND",
    "FRIEND_NOT_FOUND",
    "SOMETHING_NEW",
  ];
  const statuses = [400, 401, 404, 409, 429, 500];
  const failures = [
    ...codes.flatMap((code) =>
      statuses.map((status) =>
        friendFailure(
          new HttpError(status, { code, availableAt: day(3) }),
          NOW,
          "pl",
        ),
      ),
    ),
    friendFailure(
      new HttpError(409, { code: "FRIEND_REQUEST_COOLDOWN" }),
      NOW,
      "pl",
    ),
    friendFailure(new TypeError("offline"), NOW, "pl"),
  ];
  const keys = new Set([
    ...failures.map((failure) => failure.key),
    ...statuses.map(friendsLoadErrorKey),
    sentRequestKey({ id: "r", status: "PENDING", autoAccepted: false }),
    sentRequestKey({ id: "r", status: "ACCEPTED", autoAccepted: true }),
    "friends.requests.declinedUntil",
    "nav.friends",
  ]);

  // count: 2 picks a plural form, so keys made only of plurals exist too.
  it.each([...keys])("have %s in Polish and in English", (key) => {
    expect(i18n.exists(key, { lng: "pl", count: 2 })).toBe(true);
    expect(i18n.exists(key, { lng: "en", count: 2 })).toBe(true);
  });
});
