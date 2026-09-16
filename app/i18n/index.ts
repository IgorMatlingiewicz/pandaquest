import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import pl from "./locales/pl";
import en from "./locales/en";
import { getLanguage } from "@/lib/languageStorage";

export const SUPPORTED_LANGUAGES = ["pl", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
const DEFAULT_LANGUAGE: SupportedLanguage = "pl";

function isSupported(
  value: string | null | undefined,
): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

function resolveInitialLanguage(): SupportedLanguage {
  const deviceLanguageCode = Localization.getLocales()[0]?.languageCode;
  return isSupported(deviceLanguageCode)
    ? deviceLanguageCode
    : DEFAULT_LANGUAGE;
}

i18n.use(initReactI18next).init({
  resources: {
    pl: { translation: pl },
    en: { translation: en },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

// A previously saved explicit choice wins over the device-locale guess above,
// once the (async) storage read resolves.
getLanguage().then((stored) => {
  if (isSupported(stored) && stored !== i18n.language) {
    i18n.changeLanguage(stored);
  }
});

export default i18n;
