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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  type CategoryColor,
} from "@/constants/category-colors";

const DEFAULT_ICON = "✅";

export type CategoryFormValues = {
  name: string;
  icon: string;
  color: CategoryColor;
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
  const [color, setColor] = useState<CategoryColor>(DEFAULT_CATEGORY_COLOR);
  const [saving, setSaving] = useState(false);
  const colorScheme = useColorScheme();
  const selectionRingColor = colorScheme === "dark" ? "#ffffff" : "#000000";

  useEffect(() => {
    if (isOpen) {
      setName(initialValues?.name ?? "");
      setIcon(initialValues?.icon ?? "");
      setColor(initialValues?.color ?? DEFAULT_CATEGORY_COLOR);
    }
  }, [isOpen, initialValues]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      icon: icon.trim() || DEFAULT_ICON,
      color,
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
            {initialValues ? "Edytuj kategorię" : "Nowa kategoria"}
          </Heading>

          <VStack space="xs">
            <Text className="text-muted-foreground">Nazwa</Text>
            <Input>
              <InputField
                value={name}
                onChangeText={setName}
                placeholder="np. Treningi"
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text className="text-muted-foreground">Ikona (opcjonalnie)</Text>
            <Input>
              <InputField
                value={icon}
                onChangeText={setIcon}
                placeholder={`np. 💪  (domyślnie ${DEFAULT_ICON})`}
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text className="text-muted-foreground">Kolor</Text>
            <HStack space="sm" className="flex-wrap">
              {CATEGORY_COLORS.map((swatch) => {
                const selected = color === swatch.id;
                return (
                  <Pressable
                    key={swatch.id}
                    onPress={() => setColor(swatch.id)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: swatch.bg,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: selected ? 2 : 0,
                      borderColor: selectionRingColor,
                    }}
                  >
                    {selected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color={swatch.fg}
                      />
                    )}
                  </Pressable>
                );
              })}
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
