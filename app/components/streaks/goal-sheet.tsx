import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  maxLength: number;
  // Resolves to a translation key when it failed, to null otherwise.
  onCreate: (name: string) => Promise<string | null>;
};

export function GoalSheet({ isOpen, onClose, maxLength, onCreate }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setErrorKey(null);
    }
  }, [isOpen]);

  async function handleStart() {
    if (!name.trim()) return;
    setSaving(true);
    const failure = await onCreate(name.trim());
    setSaving(false);
    // On failure the sheet stays, with the name the user typed.
    if (failure) setErrorKey(failure);
    else onClose();
  }

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      {/* The sheet is a dialog: screen readers announce it by this name. */}
      <ActionsheetContent className="p-4" aria-label={t("streaks.form.title")}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full mt-2">
          <Heading size="md">{t("streaks.form.title")}</Heading>

          <VStack space="xs">
            <Text className="text-muted-foreground">
              {t("streaks.form.nameLabel")}
            </Text>
            <Input>
              <InputField
                value={name}
                onChangeText={setName}
                maxLength={maxLength}
                placeholder={t("streaks.form.namePlaceholder")}
                // aria-label: gluestack's field always sends its own
                // ("Input Field"), which would win over accessibilityLabel.
                aria-label={t("streaks.form.nameLabel")}
              />
            </Input>
            {errorKey && (
              <Text size="sm" className="text-destructive">
                {t(errorKey)}
              </Text>
            )}
          </VStack>

          <HStack space="sm" className="mt-2">
            <Button
              variant="outline"
              className="flex-1 min-h-11"
              onPress={onClose}
            >
              <ButtonText>{t("common.cancel")}</ButtonText>
            </Button>
            <Button
              className="flex-1 min-h-11"
              onPress={handleStart}
              isDisabled={saving || !name.trim()}
            >
              <ButtonText>
                {saving ? t("streaks.form.starting") : t("streaks.form.start")}
              </ButtonText>
            </Button>
          </HStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
