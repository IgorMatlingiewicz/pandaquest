import { useState, useEffect } from "react";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { type Task } from "./task-row";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSave: (progressCurrent: number) => Promise<void>;
};

export function ProgressUpdateSheet({ isOpen, onClose, task, onSave }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      setValue(
        task.progressCurrent != null ? String(task.progressCurrent) : "0",
      );
    }
  }, [isOpen, task]);

  async function handleSave() {
    const parsed = Number(value);
    if (!value.trim() || Number.isNaN(parsed) || parsed < 0) return;
    setSaving(true);
    await onSave(parsed);
    setSaving(false);
    onClose();
  }

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-4">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full mt-2">
          <Heading size="md">{task.title}</Heading>

          <VStack space="xs">
            <Text className="text-muted-foreground">
              {t("tasks.task.progressWithTarget", {
                target: task.progressTarget ?? "-",
              })}
            </Text>
            <Input>
              <InputField
                value={value}
                onChangeText={setValue}
                keyboardType="numeric"
                placeholder={t("tasks.task.targetPlaceholder")}
                autoFocus
              />
            </Input>
          </VStack>

          <HStack space="sm" className="mt-2">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <ButtonText>{t("common.cancel")}</ButtonText>
            </Button>
            <Button className="flex-1" onPress={handleSave} isDisabled={saving}>
              <ButtonText>
                {saving ? t("common.saving") : t("common.save")}
              </ButtonText>
            </Button>
          </HStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
