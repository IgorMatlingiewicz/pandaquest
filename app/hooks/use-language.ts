import { useTranslation } from "react-i18next";
import { type SupportedLanguage } from "@/i18n";
import { setLanguage } from "@/lib/languageStorage";

/**
 * The app's language and the one way to change it. The top bar and the
 * profile's settings both use this, so a change in one shows in the other
 * at once: the state is i18next's, there is no copy of it here.
 */
export function useLanguage() {
  const { i18n } = useTranslation();
  const language: SupportedLanguage = i18n.language === "en" ? "en" : "pl";

  function changeLanguage(next: SupportedLanguage) {
    i18n.changeLanguage(next);
    setLanguage(next);
  }

  return { language, changeLanguage };
}
