import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { useLanguage } from "@/hooks/use-language";

/*
 * The language switch, "PL" or "EN": the top bar, the login and sign-up
 * screens and the tutorial's card all show this one, so it looks and works
 * the same everywhere. A button with a name that says what a press does
 * (the bare "PL" says nothing to a screen reader), 44×44 at least. The
 * choice is saved on the device, so a language picked before signing up
 * is the one the tutorial starts in.
 */
export function LanguageToggle() {
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();

  return (
    <Pressable
      onPress={() => changeLanguage(language === "pl" ? "en" : "pl")}
      role="button"
      aria-label={t(
        language === "pl" ? "nav.switchToEnglish" : "nav.switchToPolish",
      )}
      className="min-h-11 min-w-11 items-center justify-center"
    >
      <Text className="text-muted-foreground">
        {language === "pl" ? "PL" : "EN"}
      </Text>
    </Pressable>
  );
}
