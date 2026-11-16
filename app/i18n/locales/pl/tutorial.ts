// The steps name the buttons as the screens show them, and say where
// things are in words: no "tap here" without telling where.
const tutorial = {
  counter: "{{step}}/{{total}}",
  // What a screen reader says instead of the bare counter and title.
  heading: "Krok {{step}} z {{total}}: {{title}}",
  back: "Wstecz",
  next: "Dalej",
  finish: "Zakończ",
  retry: "Spróbuj ponownie",
  saving: "Zapisywanie...",
  close: "Wyłącz samouczek",
  saveError: "Nie udało się zapisać, spróbuj ponownie.",
  menuHint: "Ekrany znajdziesz w menu ☰ w lewym górnym rogu.",
  steps: {
    welcome: {
      title: "Witaj w PandaQuest!",
      body: "Ta aplikacja zamienia codzienne obowiązki w grę: za wykonane zadania zdobywasz XP, poziomy i odznaki. Pokażę Ci krótko, jak to działa.",
    },
    tasks: {
      title: "Zadania",
      body: "Tu planujesz dzień. Zadania są w kategoriach. Przyciskiem „+ Nowa kategoria” na dole listy dodasz kategorię, a „+ Dodaj zadanie” pod kategorią dodasz zadanie. Ołówkiem po prawej edytujesz, koszem usuwasz. Zaznacz pole, gdy zadanie jest zrobione. Kolejność zmienisz, przeciągając za uchwyt po lewej.",
    },
    xp: {
      title: "XP i poziomy",
      body: "Za ukończone zadania dostajesz XP. Pasek u góry ekranu pokazuje Twój poziom i postęp do następnego. Zadania dzienne i tygodniowe odnawiają się same, a licznik przy nazwie kategorii pokazuje, ile czasu zostało.",
    },
    streaks: {
      title: "Ciągi",
      body: "Ciąg liczy czas bez czegoś, z czego rezygnujesz, np. bez słodyczy. Za każdą pełną dobę dostajesz XP, a za kolejne progi odznaki. Gdy się potkniesz, licznik zaczyna od nowa, ale rekord i odznaki zostają. Możesz mieć do 5 celów. Twoje cele są prywatne: znajomi ich nie widzą.",
    },
    stats: {
      title: "Statystyki",
      body: "Kalendarz aktywności pokazuje, ile zadań wykonujesz każdego dnia, a kropka oznacza dzień w komplecie. Kafelki podsumowują dni w komplecie, serię, XP i ukończone zadania w tym miesiącu, a wykres pokazuje XP z ostatnich 8 tygodni.",
    },
    achievements: {
      title: "Osiągnięcia",
      body: "Tu są odznaki. Wiele z nich ma kilka poziomów, od Brązu do Diamentu. Przy każdej widzisz, co trzeba zrobić, ile już masz i ile XP da następny poziom.",
    },
    friends: {
      title: "Znajomi",
      body: "Tu jest Twój kod znajomego. Podaj go komuś, a ta osoba wpisze go w polu „Kod znajomego”. Zaproszenia przyjmujesz w zakładce „Zaproszenia”. Znajomi widzą Twoją nazwę, poziom, gablotkę, liczbę odznak, datę dołączenia i zdobyte odznaki. Nic więcej.",
    },
    profile: {
      title: "Profil",
      body: "Wybierz do trzech odznak do gablotki, zobaczą je znajomi. W ustawieniach zmienisz język, motyw i hasło, a przyciskiem „Odtwórz samouczek” obejrzysz ten przewodnik jeszcze raz.",
    },
    honesty: {
      title: "Zasada uczciwości",
      body: "Aplikacja nie jest w stanie sprawdzić, czy zadanie naprawdę zostało zrobione. Ty decydujesz, co zaznaczasz, a XP i odznaki mają sens tylko wtedy, gdy są uczciwe. Śledzisz i zaznaczasz swoje postępy dla siebie, nie dla punktów.",
    },
  },
  closeConfirm: {
    title: "Czy na pewno chcesz wyłączyć samouczek?",
    message: "Możesz go odtworzyć ponownie w ustawieniach aplikacji.",
    confirm: "Wyłącz",
    cancel: "Wróć do samouczka",
  },
  farewell: {
    title: "Miłego korzystania z aplikacji!",
    message: "Samouczek możesz odtworzyć w Profilu, w ustawieniach.",
    action: "Zaczynamy",
  },
};

export default tutorial;
