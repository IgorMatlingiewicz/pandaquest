import { Platform } from "react-native";

// `cursor` isn't part of React Native's ViewStyle type, but react-native-web
// honors it at runtime. Cast is needed since it's a web-only style extension.
export const grabCursorStyle =
  Platform.OS === "web" ? ({ cursor: "grab" } as object) : undefined;
