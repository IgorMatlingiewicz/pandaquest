import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { dayKeyDate } from "@/lib/stats";

/**
 * Dates and numbers of the statistics screen in the current language. Every
 * date is a 'yyyy-MM-dd' day of the user, formatted in UTC so the device's
 * own timezone cannot move it by a day.
 */
export function useStatsFormat() {
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => {
    const inUtc = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(language, { ...options, timeZone: "UTC" });
    const short = inUtc({
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const long = inUtc({
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const dayMonth = inUtc({ day: "numeric", month: "short" });
    const monthName = inUtc({ month: "short" });
    const weekday = inUtc({ weekday: "short" });
    const number = new Intl.NumberFormat(language);

    return {
      /** "pt., 7 lis 2026" */
      shortDate: (key: string) => short.format(dayKeyDate(key)),
      /** "piątek, 7 listopada 2026", for screen readers */
      longDate: (key: string) => long.format(dayKeyDate(key)),
      /** "7 lis" */
      dayMonth: (key: string) => dayMonth.format(dayKeyDate(key)),
      /** "lis", from 'yyyy-MM' */
      month: (month: string) => monthName.format(dayKeyDate(`${month}-01`)),
      /** "pt." */
      weekday: (key: string) => weekday.format(dayKeyDate(key)),
      number: (value: number) => number.format(value),
    };
  }, [language]);
}
