import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const LANGUAGE_KEY = "pandaquest_language";

// On web this file also loads during static-export SSR (a Node process with
// no DOM), where `localStorage` doesn't exist — unlike tokenStorage.ts, this
// is called eagerly at module init (i18n/index.ts), not from a client-only
// useEffect, so it needs its own guard.
const hasLocalStorage = typeof localStorage !== "undefined";

export async function getLanguage(): Promise<string | null> {
  if (Platform.OS === "web") {
    return hasLocalStorage ? localStorage.getItem(LANGUAGE_KEY) : null;
  }
  return SecureStore.getItemAsync(LANGUAGE_KEY);
}

export async function setLanguage(language: string): Promise<void> {
  if (Platform.OS === "web") {
    if (hasLocalStorage) {
      localStorage.setItem(LANGUAGE_KEY, language);
    }
    return;
  }
  await SecureStore.setItemAsync(LANGUAGE_KEY, language);
}
