/*
 * The app's languages and which one it starts in, without i18next or the
 * device: plain data and a pure function, so the choice can be tested.
 */

export const SUPPORTED_LANGUAGES = ["pl", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * For a device in a language the app does not have: English is understood
 * more widely than Polish by someone whose phone is in, say, German. Also
 * i18next's fallback for a missing text, which never happens in practice:
 * en.ts has the type of pl.ts, so both always have every key.
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

export function isSupported(
  value: string | null | undefined,
): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

/**
 * The language to start in, from the device's language code ("pl", "en",
 * "de"…): the device's own when the app has it, else the default. A choice
 * made in the app and saved on the device wins over this later on.
 */
export function initialLanguage(
  deviceLanguageCode: string | null | undefined,
): SupportedLanguage {
  return isSupported(deviceLanguageCode)
    ? deviceLanguageCode
    : DEFAULT_LANGUAGE;
}
