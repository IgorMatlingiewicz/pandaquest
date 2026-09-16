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
            {isEditing ? "Edytuj zadanie" : "Nowe zadanie"}
          </Heading>

          <VStack space="xs">
            <Text className="text-muted-foreground">Nazwa zadania</Text>
            <Input>
              <InputField
                value={title}
                onChangeText={setTitle}
                placeholder="np. Podlej kwiaty"
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text className="text-muted-foreground">Kategoria</Text>
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
              <Text className="text-muted-foreground">Typ zadania</Text>
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
                    Zwykłe zadanie
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
                    Zadanie z postępem
                  </Text>
                </Pressable>
              </HStack>
            </VStack>
          )}

          {!isEditing && completionMode === "PROGRESS" && (
            <VStack space="xs">
              <Text className="text-muted-foreground">Cel</Text>
              <Input>
                <InputField
                  value={progressTarget}
                  onChangeText={setProgressTarget}
                  keyboardType="numeric"
                  placeholder="np. 10"
                />
              </Input>
            </VStack>
          )}

          {isExistingProgressTask && (
            <VStack space="xs">
              <Text className="text-muted-foreground">Aktualny postęp</Text>
              <Input>
                <InputField
                  value={progressCurrent}
                  onChangeText={setProgressCurrent}
                  keyboardType="numeric"
                  placeholder="np. 3"
                />
              </Input>
            </VStack>
          )}

          <HStack space="sm" className="mt-2">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <ButtonText>Anuluj</ButtonText>
            </Button>
            <Button className="flex-1" onPress={handleSave} isDisabled={saving}>
              <ButtonText>{saving ? "Zapisywanie..." : "Zapisz"}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
