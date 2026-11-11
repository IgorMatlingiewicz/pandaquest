import { Pressable } from "react-native";
import { Text } from "@/components/ui/text";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  // "tab" for a tab bar, "radio" for one choice out of a few.
  role: "tab" | "radio";
};

/*
 * One rounded choice: the tabs of the Progress screen and the options in the
 * profile's settings, so all of them look the same. Selected is said with a
 * blue border, a muted background and bold text, never by color alone.
 * aria-* and not accessibilityState: only aria-* reaches the web page.
 */
export function ChoiceChip({ label, selected, onPress, role }: Props) {
  return (
    <Pressable
      onPress={onPress}
      role={role}
      aria-selected={role === "tab" ? selected : undefined}
      aria-checked={role === "radio" ? selected : undefined}
      className={`min-h-11 items-center justify-center rounded-full border px-4 ${
        selected ? "border-blue-500 bg-muted" : "border-border"
      }`}
    >
      <Text bold={selected} className={selected ? "" : "text-muted-foreground"}>
        {label}
      </Text>
    </Pressable>
  );
}
