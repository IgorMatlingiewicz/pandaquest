import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/*
 * The "In-app reminders" switch, kept on the device as the language is
 * (languageStorage.ts): the server holds no setting for it, it only answers
 * when asked. Missing means never changed, which means on.
 */
const REMINDERS_KEY = "pandaquest_reminders";

// Static-export SSR on the web runs without a DOM, as in languageStorage.ts.
const hasLocalStorage = typeof localStorage !== "undefined";

export async function getRemindersEnabled(): Promise<boolean> {
  const stored =
    Platform.OS === "web"
      ? hasLocalStorage
        ? localStorage.getItem(REMINDERS_KEY)
        : null
      : await SecureStore.getItemAsync(REMINDERS_KEY);
  return stored !== "off";
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  const value = enabled ? "on" : "off";
  if (Platform.OS === "web") {
    if (hasLocalStorage) localStorage.setItem(REMINDERS_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(REMINDERS_KEY, value);
}
