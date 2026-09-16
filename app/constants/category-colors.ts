export type CategoryColor =
  | "RED"
  | "ORANGE"
  | "AMBER"
  | "GREEN"
  | "TEAL"
  | "BLUE"
  | "PURPLE"
  | "PINK"
  | "GRAY";

type ColorSwatch = {
  id: CategoryColor;
  label: string;
  bg: string;
  fg: string;
};

// Każdy kolor to z góry dobrana para tło+tekst, więc użytkownik nie może
// wybrać zestawienia z kiepskim kontrastem — nie ma tu dowolnego pickera.
export const CATEGORY_COLORS: ColorSwatch[] = [
  { id: "RED", label: "Czerwony", bg: "#dc2626", fg: "#ffffff" },
  { id: "ORANGE", label: "Pomarańczowy", bg: "#ea580c", fg: "#ffffff" },
  { id: "AMBER", label: "Bursztynowy", bg: "#f59e0b", fg: "#1c1917" },
  { id: "GREEN", label: "Zielony", bg: "#16a34a", fg: "#ffffff" },
  { id: "TEAL", label: "Morski", bg: "#0d9488", fg: "#ffffff" },
  { id: "BLUE", label: "Niebieski", bg: "#2563eb", fg: "#ffffff" },
  { id: "PURPLE", label: "Fioletowy", bg: "#9333ea", fg: "#ffffff" },
  { id: "PINK", label: "Różowy", bg: "#db2777", fg: "#ffffff" },
  { id: "GRAY", label: "Szary", bg: "#52525b", fg: "#ffffff" },
];

export const DEFAULT_CATEGORY_COLOR: CategoryColor = "GRAY";

export function getCategoryColor(id: CategoryColor | undefined | null) {
  return (
    CATEGORY_COLORS.find((c) => c.id === id) ??
    CATEGORY_COLORS.find((c) => c.id === DEFAULT_CATEGORY_COLOR)!
  );
}
