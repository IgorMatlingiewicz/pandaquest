const profile = {
  badgeCount: "Odznaki: {{earned}} z {{total}}",
  joined: "W PandaQuest od: {{date}}",
  showAllBadges: "Zobacz wszystkie odznaki",
  loadError: "Nie udało się wczytać profilu.",
  retry: "Spróbuj ponownie",
  showcase: {
    title: "Gablotka",
    hint: "Pokaż do trzech ulubionych odznak.",
    emptySlot: "Puste miejsce {{number}} w gablotce. Dodaj odznakę.",
    badgeSlot:
      "Miejsce {{number}} w gablotce: {{name}}, {{tier}}. Zmień lub usuń.",
    // A friend's showcase only shows: no action to name.
    emptySlotReadOnly: "Miejsce {{number}} w gablotce: puste.",
    badgeSlotReadOnly: "Miejsce {{number}} w gablotce: {{name}}, {{tier}}.",
    saving: "Zapisywanie",
    saveError: "Nie udało się zapisać gablotki",
    invalid:
      "Nie udało się zapisać gablotki. Odśwież ekran i spróbuj ponownie.",
    notEarned:
      "Tej odznaki nie ma wśród Twoich zdobytych. Odśwież ekran i spróbuj ponownie.",
  },
  picker: {
    title: "Wybierz odznakę",
    empty:
      "Nie masz jeszcze zdobytych odznak. Wykonuj zadania, a pojawią się tutaj.",
    allShown: "Wszystkie zdobyte odznaki są już w gablotce.",
  },
  slotMenu: {
    change: "Zmień",
    remove: "Usuń z gablotki",
  },
  settings: {
    title: "Ustawienia",
    language: "Język",
    languages: { pl: "Polski", en: "English" },
    theme: "Motyw",
    themes: { light: "Jasny", dark: "Ciemny" },
    changePassword: "Zmień hasło",
    replayTutorial: "Odtwórz samouczek",
  },
  password: {
    title: "Zmień hasło",
    current: "Obecne hasło",
    next: "Nowe hasło",
    repeat: "Powtórz nowe hasło",
    submit: "Zmień hasło",
    submitting: "Zmienianie...",
    changed: "Hasło zostało zmienione",
    required: "Wypełnij to pole.",
    mismatch: "Hasła nie są takie same.",
    wrongCurrent: "Obecne hasło jest nieprawidłowe.",
    tooWeak: "Nowe hasło musi mieć co najmniej 8 znaków.",
    sameAsCurrent: "Nowe hasło musi różnić się od obecnego.",
  },
};

export default profile;
