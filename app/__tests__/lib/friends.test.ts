import {
  FRIEND_CODE_ALPHABET,
  FRIEND_CODE_LENGTH,
  daysUntil,
  formatFriendCode,
  friendCodeChars,
  isCompleteFriendCode,
  resendValues,
  sentRequestKey,
} from "@/lib/friends";

describe("the friend code rules", () => {
  // As in backend/src/friends/friend-code.ts; a change there must show here.
  it("are those of the server: 8 of 32 characters, no O, 0, I or 1", () => {
    expect(FRIEND_CODE_LENGTH).toBe(8);
    expect(FRIEND_CODE_ALPHABET).toHaveLength(32);
    expect(FRIEND_CODE_ALPHABET).not.toMatch(/[O0I1]/);
  });
});

describe("friendCodeChars", () => {
  it.each([
    ["abcd-efgh", "ABCDEFGH"],
    [" ab cd\tef-gh ", "ABCDEFGH"],
    ["ABCD–EFGH", "ABCDEFGH"], // an en dash, as some keyboards paste
    ["ab0c1dOI", "ABCD"], // characters no code has
    ["ąbćd", "BD"],
    ["ABCDEFGHJK", "ABCDEFGH"], // never more than 8
    ["", ""],
  ])("takes %j as %j", (input, chars) => {
    expect(friendCodeChars(input)).toBe(chars);
  });
});

describe("formatFriendCode", () => {
  it.each([
    ["", ""],
    ["a", "A"],
    ["abcd", "ABCD"], // no dash yet, so backspace never stops on one
    ["abcde", "ABCD-E"],
    ["abcdefgh", "ABCD-EFGH"],
    ["ABCD-EFGH", "ABCD-EFGH"], // formatting twice changes nothing
    ["ABCD-", "ABCD"], // deleting the 5th character drops the dash too
  ])("shows %j as %j", (input, shown) => {
    expect(formatFriendCode(input)).toBe(shown);
  });

  it("shows a pasted code with stray text around it as typed", () => {
    expect(formatFriendCode("  efgh2345\n")).toBe("EFGH-2345");
  });
});

describe("isCompleteFriendCode", () => {
  it.each([
    ["ABCD-EFGH", true],
    ["abcdefgh", true],
    ["ABCD-EFG", false],
    ["ABCD-EFG0", false], // 0 is no code character
    ["", false],
  ])("says %j is complete: %s", (input, complete) => {
    expect(isCompleteFriendCode(input)).toBe(complete);
  });
});

describe("daysUntil", () => {
  const NOW = Date.parse("2026-11-14T12:00:00.000Z");

  it.each([
    ["2026-11-21T12:00:00.000Z", 7], // exactly 7 days
    ["2026-11-21T11:59:00.000Z", 7], // a minute short still begins day 7
    ["2026-11-14T14:00:00.000Z", 1], // 2 hours left is 1 day
    ["2026-11-14T12:00:00.000Z", 0], // now
    ["2026-11-13T12:00:00.000Z", 0], // already past
  ])("from now to %s is %i", (iso, days) => {
    expect(daysUntil(iso, NOW)).toBe(days);
  });
});

describe("resendValues", () => {
  const NOW = Date.parse("2026-11-14T12:00:00.000Z");
  // Noon UTC: the same calendar day in every European timezone.
  const IN_A_WEEK = "2026-11-21T12:00:00.000Z";

  it("counts the days and writes the date in the app's language", () => {
    expect(resendValues(IN_A_WEEK, NOW, "pl")).toEqual({
      count: 7,
      date: expect.stringContaining("21 lis 2026"),
    });
    expect(resendValues(IN_A_WEEK, NOW, "en").date).toContain("Nov 21, 2026");
  });

  it("never says 0 days while the server still refuses", () => {
    // A device clock running ahead puts the end in the past.
    const later = Date.parse("2026-11-22T12:00:00.000Z");

    expect(resendValues(IN_A_WEEK, later, "pl").count).toBe(1);
  });
});

describe("sentRequestKey", () => {
  it.each([
    [false, "friends.add.sent"],
    [true, "friends.add.nowFriends"],
  ])("tells the sender, when auto-accepted is %s, %s", (autoAccepted, key) => {
    expect(
      sentRequestKey({
        id: "r-1",
        status: autoAccepted ? "ACCEPTED" : "PENDING",
        autoAccepted,
      }),
    ).toBe(key);
  });
});
