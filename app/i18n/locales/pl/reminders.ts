// The in-app reminders window. Counts follow Polish plural forms: _one (1),
// _few (2-4, 22-24, ...), _many (0, 5-21, 25-31, ...); _other is for
// fractions, which never come, written as in badges.ts.
const reminders = {
  title: "Przypomnienie",
  close: "Zamknij",
  goToTasks: "Przejdź do zadań",
  goToFriends: "Przejdź do Znajomych",
  daily_one:
    "Dzień dobiega końca, a masz jeszcze {{count}} niezrobione zadanie dzienne. Czas mija o północy.",
  daily_few:
    "Dzień dobiega końca, a masz jeszcze {{count}} niezrobione zadania dzienne. Czas mija o północy.",
  daily_many:
    "Dzień dobiega końca, a masz jeszcze {{count}} niezrobionych zadań dziennych. Czas mija o północy.",
  daily_other:
    "Dzień dobiega końca, a masz jeszcze {{count}} niezrobionego zadania dziennego. Czas mija o północy.",
  weekly:
    "To ostatnia doba tygodnia: na zadania tygodniowe zostało nie więcej niż 24 godziny.",
  // "Seria", as the tile on the statistics screen: full days or weeks in a
  // row, not the timed streak goals. The count in brackets reads right for
  // every number ("seria 1 dni" would not).
  streakDays_one: "Uwaga: Twoja seria ({{count}} dzień) jest zagrożona!",
  streakDays_few: "Uwaga: Twoja seria ({{count}} dni) jest zagrożona!",
  streakDays_many: "Uwaga: Twoja seria ({{count}} dni) jest zagrożona!",
  streakDays_other: "Uwaga: Twoja seria ({{count}} dnia) jest zagrożona!",
  streakWeeks_one: "Uwaga: Twoja seria ({{count}} tydzień) jest zagrożona!",
  streakWeeks_few: "Uwaga: Twoja seria ({{count}} tygodnie) jest zagrożona!",
  streakWeeks_many: "Uwaga: Twoja seria ({{count}} tygodni) jest zagrożona!",
  streakWeeks_other: "Uwaga: Twoja seria ({{count}} tygodnia) jest zagrożona!",
  friends_one:
    "Masz {{count}} nowe zaproszenie do znajomych. Sprawdź zakładkę Znajomi.",
  friends_few:
    "Masz {{count}} nowe zaproszenia do znajomych. Sprawdź zakładkę Znajomi.",
  friends_many:
    "Masz {{count}} nowych zaproszeń do znajomych. Sprawdź zakładkę Znajomi.",
  friends_other:
    "Masz {{count}} nowych zaproszeń do znajomych. Sprawdź zakładkę Znajomi.",
};

export default reminders;
