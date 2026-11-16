const friends = {
  loadError: "Nie udało się wczytać znajomych.",
  retry: "Spróbuj ponownie",
  tabs: {
    friends: "Znajomi",
    requests: "Zaproszenia",
    requestsCount: "Zaproszenia ({{count}})",
  },
  code: {
    title: "Twój kod",
    hint: "Podaj go znajomemu, aby mógł Cię zaprosić.",
    label: "Twój kod znajomego: {{spelled}}",
    copy: "Kopiuj",
    copied: "Skopiowano kod",
    copyFailed: "Nie udało się skopiować kodu",
    regenerate: "Wygeneruj nowy",
    regenerating: "Generowanie...",
    regenerated: "Masz nowy kod",
    confirmTitle: "Wygenerować nowy kod?",
    confirmMessage:
      "Obecny kod przestanie działać od razu: kto go zna, nie zaprosi Cię już nim.",
    confirmNote: "Twoi znajomi i zaproszenia zostają bez zmian.",
  },
  add: {
    title: "Dodaj znajomego",
    label: "Kod znajomego",
    submit: "Wyślij zaproszenie",
    submitting: "Wysyłanie...",
    sent: "Zaproszenie wysłane",
    nowFriends: "Ta osoba też Cię zaprosiła. Jesteście teraz znajomymi!",
  },
  profile: {
    back: "Znajomi",
    remove: "Usuń ze znajomych",
    removing: "Usuwanie...",
    removeTitle: "Usunąć ze znajomych: {{name}}?",
    removeMessage:
      "Ta osoba zniknie z Twojej listy, a Ty z jej. W każdej chwili możecie zaprosić się ponownie.",
    removed: "Usunięto ze znajomych: {{name}}",
  },
  badges: {
    back: "Profil",
    title: "Zdobyte odznaki: {{count}}",
    empty: "Ta osoba nie ma jeszcze żadnej odznaki.",
  },
  list: {
    title: "Twoi znajomi ({{count}})",
    empty:
      "Nie masz jeszcze znajomych. Podaj komuś swój kod albo wpisz kod znajomego.",
    open: "{{name}}, poziom {{level}}. Otwórz profil.",
  },
  requests: {
    incoming: "Otrzymane",
    outgoing: "Wysłane",
    incomingEmpty: "Nie masz nowych zaproszeń.",
    outgoingEmpty: "Nie czekasz na żadną odpowiedź.",
    accept: "Akceptuj",
    decline: "Odrzuć",
    cancel: "Cofnij",
    acceptFrom: "Akceptuj zaproszenie od: {{name}}",
    declineFrom: "Odrzuć zaproszenie od: {{name}}",
    cancelTo: "Cofnij zaproszenie do: {{name}}",
    waiting: "Czeka na odpowiedź",
    accepted: "Ty i {{name}} jesteście teraz znajomymi",
    declinedUntil_one:
      "Zaproszenie odrzucone. Ponownie możesz zaprosić za {{count}} dzień ({{date}}).",
    declinedUntil_few:
      "Zaproszenie odrzucone. Ponownie możesz zaprosić za {{count}} dni ({{date}}).",
    declinedUntil_many:
      "Zaproszenie odrzucone. Ponownie możesz zaprosić za {{count}} dni ({{date}}).",
    declinedUntil_other:
      "Zaproszenie odrzucone. Ponownie możesz zaprosić za {{count}} dni ({{date}}).",
  },
  errors: {
    INVALID_FRIEND_CODE:
      "Nie znaleziono nikogo z tym kodem. Sprawdź, czy jest wpisany poprawnie.",
    CANNOT_ADD_SELF: "To Twój własny kod.",
    ALREADY_FRIENDS: "Ta osoba jest już Twoim znajomym.",
    REQUEST_ALREADY_SENT: "Zaproszenie do tej osoby już czeka na odpowiedź.",
    FRIEND_REQUEST_COOLDOWN_one:
      "Ta osoba odrzuciła Twoje zaproszenie. Ponowne możesz wysłać za {{count}} dzień ({{date}}).",
    FRIEND_REQUEST_COOLDOWN_few:
      "Ta osoba odrzuciła Twoje zaproszenie. Ponowne możesz wysłać za {{count}} dni ({{date}}).",
    FRIEND_REQUEST_COOLDOWN_many:
      "Ta osoba odrzuciła Twoje zaproszenie. Ponowne możesz wysłać za {{count}} dni ({{date}}).",
    FRIEND_REQUEST_COOLDOWN_other:
      "Ta osoba odrzuciła Twoje zaproszenie. Ponowne możesz wysłać za {{count}} dni ({{date}}).",
    cooldownLater:
      "Ta osoba odrzuciła Twoje zaproszenie. Ponowne możesz wysłać później.",
    TOO_MANY_PENDING_REQUESTS:
      "Za dużo Twoich zaproszeń czeka na odpowiedź. Cofnij któreś, aby wysłać nowe.",
    FRIEND_LIMIT_REACHED:
      "Ty albo ta osoba macie już największą dozwoloną liczbę znajomych.",
    REQUEST_NOT_FOUND: "To zaproszenie jest już nieaktualne.",
    FRIEND_NOT_FOUND: "Ta osoba nie jest już Twoim znajomym.",
    tooManyAttempts: "Zbyt wiele prób. Spróbuj za chwilę.",
  },
};

export default friends;
