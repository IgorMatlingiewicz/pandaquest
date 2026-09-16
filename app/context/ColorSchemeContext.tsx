import { createContext, useContext, useState, type ReactNode } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";

export type AppColorScheme = "light" | "dark";

type ColorSchemeContextType = {
  colorScheme: AppColorScheme;
  toggleColorScheme: () => void;
};

const ColorSchemeContext = createContext<ColorSchemeContextType | undefined>(
  undefined,
);

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [colorScheme, setColorScheme] = useState<AppColorScheme>(
    systemScheme === "dark" ? "dark" : "light",
  );

  function toggleColorScheme() {
    setColorScheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <ColorSchemeContext.Provider value={{ colorScheme, toggleColorScheme }}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useAppColorScheme() {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) {
    throw new Error(
      "useAppColorScheme musi być użyty wewnątrz ColorSchemeProvider",
    );
  }
  return ctx;
}
