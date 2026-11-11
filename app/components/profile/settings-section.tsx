import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ChoiceChip } from "@/components/choice-chip";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/context/AuthContext";
import {
  useAppColorScheme,
  type AppColorScheme,
} from "@/context/ColorSchemeContext";
import { useChangePassword } from "@/hooks/use-change-password";
import { useLanguage } from "@/hooks/use-language";
import type { SupportedLanguage } from "@/i18n";

const LANGUAGES: SupportedLanguage[] = ["pl", "en"];
const SCHEMES: AppColorScheme[] = ["light", "dark"];

type ChoiceRowProps<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
};

function ChoiceRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: ChoiceRowProps<T>) {
  return (
    <VStack space="xs">
      <Text className="text-muted-foreground">{label}</Text>
      <View role="radiogroup" aria-label={label} className="flex-row gap-2">
        {options.map((option) => (
          <ChoiceChip
            key={option.value}
            role="radio"
            label={option.label}
            selected={option.value === selected}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </View>
    </VStack>
  );
}

/*
 * Language and theme are the top bar's own controls once more, over the very
 * same state (i18next and ColorSchemeContext), so either place changes both.
 * Log out is the top bar's handler too, with no extra question, as there.
 */
export function SettingsSection() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useAppColorScheme();
  const { language, changeLanguage } = useLanguage();
  const { submit, saving } = useChangePassword();
  const toast = useToast();
  const [passwordOpen, setPasswordOpen] = useState(false);

  async function changePassword(current: string, next: string) {
    const failure = await submit(current, next);
    if (!failure) {
      toast.show({
        placement: "top",
        duration: 3000,
        render: ({ id }) => (
          <Toast nativeID={`toast-${id}`} action="success" variant="solid">
            <ToastTitle>{t("profile.password.changed")}</ToastTitle>
          </Toast>
        ),
      });
    }
    return failure;
  }

  return (
    <Card>
      <Heading size="md">{t("profile.settings.title")}</Heading>

      <ChoiceRow
        label={t("profile.settings.language")}
        options={LANGUAGES.map((value) => ({
          value,
          label: t(`profile.settings.languages.${value}`),
        }))}
        selected={language}
        onSelect={changeLanguage}
      />
      <ChoiceRow
        label={t("profile.settings.theme")}
        options={SCHEMES.map((value) => ({
          value,
          label: t(`profile.settings.themes.${value}`),
        }))}
        selected={colorScheme}
        // The context only toggles, so choosing the other one toggles.
        onSelect={(value) => {
          if (value !== colorScheme) toggleColorScheme();
        }}
      />

      <VStack space="sm">
        <Button
          variant="outline"
          className="min-h-11"
          onPress={() => setPasswordOpen(true)}
        >
          <ButtonText>{t("profile.settings.changePassword")}</ButtonText>
        </Button>
        <Button variant="outline" className="min-h-11" onPress={logout}>
          <ButtonText>{t("common.logout")}</ButtonText>
        </Button>
      </VStack>

      <ChangePasswordDialog
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        saving={saving}
        onSubmit={changePassword}
      />
    </Card>
  );
}
