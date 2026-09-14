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

const DEFAULT_ICON = "✅";

export type CategoryFormValues = {
  name: string;
  icon: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialValues?: CategoryFormValues;
  onSave: (values: CategoryFormValues) => Promise<void>;
};

export function CategorySheet({
  isOpen,
  onClose,
  initialValues,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialValues?.name ?? "");
      setIcon(initialValues?.icon ?? "");
    }
  }, [isOpen, initialValues]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), icon: icon.trim() || DEFAULT_ICON });
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
            {initialValues ? "Edytuj kategorię" : "Nowa kategoria"}
          </Heading>

          <VStack space="xs">
            <Text className="text-typography-500">Nazwa</Text>
            <Input>
              <InputField
                value={name}
                onChangeText={setName}
                placeholder="np. Treningi"
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text className="text-typography-500">Ikona (opcjonalnie)</Text>
            <Input>
              <InputField
                value={icon}
                onChangeText={setIcon}
                placeholder={`np. 💪  (domyślnie ${DEFAULT_ICON})`}
              />
            </Input>
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
