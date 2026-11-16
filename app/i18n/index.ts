import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import pl from "./locales/pl";
import en from "./locales/en";
import { DEFAULT_LANGUAGE, initialLanguage, isSupported } from "./languages";
import { getLanguage } from "@/lib/languageStorage";

export { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./languages";

i18n.use(initReactI18next).init({
  resources: {
    pl: { translation: pl },
    en: { translation: en },
  },
  lng: initialLanguage(Localization.getLocales()[0]?.languageCode),
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
