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
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type CompletionMode = "BOOLEAN" | "PROGRESS";

export type TaskFormValues = {
  title: string;
  categoryId: string;
  completionMode?: CompletionMode;
  progressTarget?: number;
  progressCurrent?: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  initialValues?: TaskFormValues;
  isEditing?: boolean;
  onSave: (values: TaskFormValues) => Promise<void>;
};

export function TaskSheet({
  isOpen,
  onClose,
  categories,
  initialValues,
  isEditing = false,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [completionMode, setCompletionMode] =
    useState<CompletionMode>("BOOLEAN");
  const [progressTarget, setProgressTarget] = useState("");
  const [progressCurrent, setProgressCurrent] = useState("");
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      setTitle(initialValues?.title ?? "");
      setCategoryId(initialValues?.categoryId ?? categories[0]?.id ?? "");
      setCompletionMode(initialValues?.completionMode ?? "BOOLEAN");
      setProgressTarget("");
      setProgressCurrent(
        initialValues?.progressCurrent != null
          ? String(initialValues.progressCurrent)
          : "",
      );
    }
  }, [isOpen, initialValues, categories]);

  const isExistingProgressTask =
    isEditing && initialValues?.completionMode === "PROGRESS";

  async function handleSave() {
    if (!title.trim() || !categoryId) return;
    setSaving(true);

    await onSave({
      title: title.trim(),
      categoryId,
      completionMode: !isEditing ? completionMode : undefined,
      progressTarget:
        !isEditing && completionMode === "PROGRESS" && progressTarget.trim()
          ? Number(progressTarget)
          : undefined,
      progressCurrent:
        isExistingProgressTask && progressCurrent.trim()
          ? Number(progressCurrent)
          : undefined,
    });

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
          <Heading size="md">
            {isEditing ? t("tasks.task.editTitle") : t("tasks.task.newTitle")}
          </Heading>

          <VStack space="xs">
            <Text className="text-muted-foreground">
              {t("tasks.task.nameLabel")}
            </Text>
            <Input>
              <InputField
                value={title}
                onChangeText={setTitle}
                placeholder={t("tasks.task.namePlaceholder")}
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text className="text-muted-foreground">
              {t("tasks.task.categoryLabel")}
            </Text>
            <HStack space="sm" className="flex-wrap">
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  className={`px-3 py-2 rounded-full border ${
                    categoryId === cat.id
                      ? "border-primary bg-primary"
                      : "border-border bg-transparent"
                  }`}
                >
                  <Text
                    className={
                      categoryId === cat.id
                        ? "text-primary-foreground"
                        : "text-foreground"
                    }
                  >
                    {cat.icon ? `${cat.icon} ` : ""}
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          </VStack>

          {!isEditing && (
            <VStack space="xs">
              <Text className="text-muted-foreground">
                {t("tasks.task.typeLabel")}
              </Text>
              <HStack space="sm">
                <Pressable
                  onPress={() => setCompletionMode("BOOLEAN")}
                  className={`px-3 py-2 rounded-full border ${
                    completionMode === "BOOLEAN"
                      ? "border-primary bg-primary"
                      : "border-border bg-transparent"
                  }`}
                >
                  <Text
                    className={
                      completionMode === "BOOLEAN"
                        ? "text-primary-foreground"
                        : "text-foreground"
                    }
                  >
                    {t("tasks.task.typeBoolean")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setCompletionMode("PROGRESS")}
                  className={`px-3 py-2 rounded-full border ${
                    completionMode === "PROGRESS"
                      ? "border-primary bg-primary"
                      : "border-border bg-transparent"
                  }`}
                >
                  <Text
                    className={
                      completionMode === "PROGRESS"
                        ? "text-primary-foreground"
                        : "text-foreground"
                    }
                  >
                    {t("tasks.task.typeProgress")}
                  </Text>
                </Pressable>
              </HStack>
            </VStack>
          )}

          {!isEditing && completionMode === "PROGRESS" && (
            <VStack space="xs">
              <Text className="text-muted-foreground">
                {t("tasks.task.targetLabel")}
              </Text>
              <Input>
                <InputField
                  value={progressTarget}
                  onChangeText={setProgressTarget}
                  keyboardType="numeric"
                  placeholder={t("tasks.task.targetPlaceholder")}
                />
              </Input>
            </VStack>
          )}

          {isExistingProgressTask && (
            <VStack space="xs">
              <Text className="text-muted-foreground">
                {t("tasks.task.currentProgressLabel")}
              </Text>
              <Input>
                <InputField
                  value={progressCurrent}
                  onChangeText={setProgressCurrent}
                  keyboardType="numeric"
                  placeholder={t("tasks.task.currentProgressPlaceholder")}
                />
              </Input>
            </VStack>
          )}

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
