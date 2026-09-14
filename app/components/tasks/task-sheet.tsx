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

export type TaskFormValues = {
  title: string;
  categoryId: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  initialValues?: TaskFormValues;
  onSave: (values: TaskFormValues) => Promise<void>;
};

export function TaskSheet({
  isOpen,
  onClose,
  categories,
  initialValues,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialValues?.title ?? "");
      setCategoryId(initialValues?.categoryId ?? categories[0]?.id ?? "");
    }
  }, [isOpen, initialValues, categories]);

  async function handleSave() {
    if (!title.trim() || !categoryId) return;
    setSaving(true);
    await onSave({ title: title.trim(), categoryId });
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
            {initialValues ? "Edytuj zadanie" : "Nowe zadanie"}
          </Heading>

          <VStack space="xs">
            <Text className="text-typography-500">Nazwa zadania</Text>
            <Input>
              <InputField
                value={title}
                onChangeText={setTitle}
                placeholder="np. Podlej kwiaty"
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text className="text-typography-500">Kategoria</Text>
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
