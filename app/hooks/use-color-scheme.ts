import { useAppColorScheme } from "@/context/ColorSchemeContext";

// Same signature as RN's useColorScheme (returns just the string), but backed
// by our own overridable app state instead of the raw system value — so an
// explicit in-app toggle (which react-native-web can't do via Appearance)
// still reaches every consumer of this hook (tabs, ThemedText/ThemedView...).
export function useColorScheme() {
  return useAppColorScheme().colorScheme;
}
