import {
  DEFAULT_LANGUAGE,
  initialLanguage,
  isSupported,
  SUPPORTED_LANGUAGES,
} from "@/i18n/languages";

describe("initialLanguage", () => {
  it.each([
    ["pl", "pl"], // a Polish device
    ["en", "en"], // an English device
    ["de", "en"], // a language the app does not have: English
    ["uk", "en"],
    ["PL", "en"], // codes come lower-case from the device; anything else is unknown
    [null, "en"], // the device says nothing
    [undefined, "en"],
  ])("starts a %s device in %s", (device, language) => {
    expect(initialLanguage(device)).toBe(language);
  });
});

describe("the languages", () => {
  it("are Polish and English, with English as the default", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["pl", "en"]);
    expect(DEFAULT_LANGUAGE).toBe("en");
  });

  it("tell a supported code from any other value", () => {
    expect([isSupported("pl"), isSupported("en")]).toEqual([true, true]);
    expect([isSupported("de"), isSupported(""), isSupported(null)]).toEqual([
      false,
      false,
      false,
    ]);
  });
});
