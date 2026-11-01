import { useWindowDimensions } from "react-native";
import { WIDE_SCREEN } from "@/constants/layout";

export function useIsWide() {
  return useWindowDimensions().width >= WIDE_SCREEN;
}
