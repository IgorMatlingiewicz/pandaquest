# PandaQuest

Gamifikowany system zarządzania produktywnością: praca inżynierska.

Użytkownik prowadzi zadania dzienne, tygodniowe, życiowe i poboczne w kategoriach. Za ich wykonywanie dostaje punkty doświadczenia (XP), poziomy, mnożnik za serie oraz odznaki. Moduł Ciągi liczy czas bez wybranego nawyku, na przykład słodyczy, i nagradza każdą pełną dobę. Czas liczy wyłącznie serwer. Aplikacja działa na telefonie i w przeglądarce, po polsku i po angielsku.

Nazwy celów z modułu Ciągi mogą zdradzać sprawy zdrowotne. Są prywatne, nie trafiają do logów ani do innych użytkowników, ale w bazie leżą bez szyfrowania.

## Struktura repozytorium

| Katalog | Zawartość |
| --- | --- |
| `app/` | aplikacja kliencka: Expo (React Native), Expo Router, Gluestack UI, NativeWind, i18next |
| `backend/` | API: NestJS, Prisma, PostgreSQL, uwierzytelnianie JWT |
| katalog główny | baza w Dockerze (`docker-compose.yml`), CI (`.github/workflows/ci.yml`) i hook przed commitem (husky, lint-staged) |

`app/` i `backend/` to osobne projekty pnpm, każdy ma własne zależności i lockfile.

## Wymagania

- **Node.js 24** (https://nodejs.org)
- **pnpm 11**: `npm install -g pnpm@11`. Projekt przypina dokładną wersję 11.25.0 w polu `packageManager`, a pnpm 11 sam ją pobierze. Starszych wersji pnpm nie sprawdzano, dlatego zalecana jest 11.
- **Docker Desktop** (https://www.docker.com/products/docker-desktop): baza PostgreSQL 18 działa w kontenerze, nie trzeba jej instalować.
- **Git**
- opcjonalnie **Expo Go** na telefonie (Android lub iOS)

## Uruchomienie od zera

Komendy działają w PowerShellu i w Bashu (w PowerShellu `cp` to alias `Copy-Item`). Każdą sekcję zaczynaj w katalogu głównym repozytorium.

### 0. Pobranie kodu

```bash
git clone https://github.com/IgorMatlingiewicz/pandaquest.git
cd pandaquest
```

### 1. Baza danych

Uruchom Docker Desktop i poczekaj, aż wystartuje. Potem:

```bash
cp .env.example .env
docker compose up -d --wait
```

W pliku `.env` ustaw własne hasło (przed pierwszym `docker compose up`, bo hasło zapisuje się przy zakładaniu bazy). `--wait` czeka, aż baza przyjmuje połączenia, więc po powrocie komendy można od razu przejść dalej. Kontener nazywa się `pandaquest-db`, nasłuchuje na porcie 5432, a dane trzyma w wolumenie `pgdata`, więc przetrwają restart komputera.

### 2. Backend

```bash
cd backend
cp .env.example .env
pnpm install
pnpm exec prisma generate --config prisma7.config.ts
pnpm exec prisma migrate deploy --config prisma7.config.ts
pnpm start:dev
```

W `backend/.env`:
- `DATABASE_URL`: te same użytkownik, hasło i nazwa bazy co w `.env` z katalogu głównego,
- `JWT_SECRET`: długi losowy ciąg; komenda do jego wygenerowania jest w `backend/.env.example`.

Klient Prisma nie jest przechowywany w repozytorium, dlatego `prisma generate` jest osobnym krokiem. Każda komenda Prismy wymaga `--config prisma7.config.ts`, bo plik konfiguracji ma niestandardową nazwę.

Sprawdzenie: `http://localhost:3000/health` zwraca `{"status":"ok"}`. Odpowiedź `503` oznacza, że backend działa, ale nie ma połączenia z bazą.

### 3. Aplikacja

W drugim terminalu (backend zostaje włączony):

```bash
cd app
cp .env.example .env
pnpm install
pnpm start
```

- **W przeglądarce:** naciśnij `w` w terminalu Expo (albo od razu `pnpm web`).
- **Na telefonie (Expo Go):** zeskanuj kod QR z terminala. Wcześniej ustaw w `app/.env` adres komputera w sieci lokalnej, bo na telefonie `localhost` oznacza sam telefon:
  1. Windows: komenda `ipconfig`, wiersz „Adres IPv4” karty Wi-Fi (np. `192.168.1.50`); macOS: `ipconfig getifaddr en0`; Linux: `hostname -I`.
  2. W `app/.env`: `EXPO_PUBLIC_API_URL=http://192.168.1.50:3000` (Twój adres).
  3. Uruchom Expo od nowa z czyszczeniem pamięci: `pnpm start -c`. Adres jest wpisywany w aplikację przy budowaniu, więc sam zapis pliku nie wystarczy.
  4. Telefon i komputer muszą być w tej samej sieci Wi-Fi. Na Windowsie przy pierwszym starcie backendu zapora może zapytać o dostęp dla Node.js: zezwól w sieciach prywatnych.

### 4. Konto

Kont testowych nie ma: załóż własne na ekranie rejestracji (e-mail, nazwa od 3 znaków, hasło od 8 znaków). Domyślne kategorie i przykładowe zadania tworzą się automatycznie, w języku wybranym przy rejestracji. Po pierwszym zalogowaniu startuje samouczek.

## Testy i jakość kodu

| Gdzie | Komenda | Co sprawdza | Baza? |
| --- | --- | --- | --- |
| `backend/` | `pnpm test` | testy jednostkowe i scenariuszowe (Jest, atrapa bazy w pamięci) | nie |
| `backend/` | `pnpm test:e2e` | testy integracyjne przez HTTP na prawdziwym PostgreSQL, w tym równoległe żądania | tak |
| `backend/` | `pnpm test:mutation` | jakość testów logiki odznak i ciągów (StrykerJS), raport w `reports/mutation/` | nie |
| `backend/` | `pnpm lint` | ESLint, z automatycznymi poprawkami | nie |
| `app/` | `pnpm test` | logika widoku, konteksty, teksty PL/EN (jest-expo, `app/__tests__/`) | nie |
| `app/` | `pnpm typecheck` | typy TypeScript | nie |
| `app/` | `pnpm lint` | ESLint | nie |

**Testy e2e** potrzebują działającej bazy z kroku 1 (Docker włączony). Biorą adres z `backend/.env`, zamieniają w nim nazwę bazy na `pandaquest_test`, zakładają ją, nakładają migracje i czyszczą przed każdym testem. Bazy deweloperskiej nie dotykają, a gdyby adres wskazywał inną bazę, odmówią czyszczenia.

**CI:** każdy push na `main` i każdy pull request uruchamia na GitHubie (zakładka Actions) lint, typecheck i wszystkie powyższe testy poza mutacyjnymi, backend na świeżym PostgreSQL 18.

Typy Expo (`app/expo-env.d.ts`) powstają przy pierwszym `pnpm start`. Na świeżym klonie, bez uruchamiania aplikacji, `pnpm typecheck` zgłosi wtedy błędy typu `Cannot find name 'process'` albo `'global'`. Wystarczy raz uruchomić `pnpm start` (i zamknąć) albo utworzyć ten plik ręcznie, jak robi CI:

```bash
echo '/// <reference types="expo/types" />' > expo-env.d.ts
```

Hook przed commitem uruchamia ESLint i Prettier na dodanych plikach `.ts` i `.tsx`, więc może je przy okazji sformatować.

## Test wydajności API

Powtarzalny pomiar czterech endpointów (`GET /health`, `GET /tasks`, `GET /stats`, `PATCH /tasks/:id`) narzędziem autocannon. Wymaga działającej bazy z kroku 1, `backend/.env` z kroku 2 i wolnego portu 3100.

```bash
cd backend
pnpm build   # test uruchamia zbudowany serwer (dist/main.js)
pnpm perf    # ok. 17 minut; pnpm perf --drop usuwa na końcu bazę testową
```

Skrypt (`backend/perf/`) zakłada bazę `pandaquest_perf` w tym samym kontenerze, nakłada migracje i czyści ją na starcie. Na innej bazie odmówi działania, a deweloperskiej nie dotyka. Potem uruchamia serwer na porcie 3100 i przez API tworzy 50 kont po 28 zadań. Każdy scenariusz mierzy przy 10 i 50 połączeniach, każde połączenie jako osobny użytkownik: 5 s rozgrzewki, potem 30 s pomiaru, całość w 3 przebiegach. Wyniki trafiają do `backend/perf/results/` (poza gitem): surowe w `.json`, tabela median ze środowiskiem i parametrami w `.md`.

Generator obciążenia i serwer działają na jednym komputerze, więc przed pomiarem podłącz zasilanie, ustaw tryb „Najlepsza wydajność” i zamknij ciężkie programy.

## Najczęstsze problemy

| Objaw | Przyczyna i rozwiązanie |
| --- | --- |
| `docker compose` zgłasza błąd połączenia z Dockerem | Docker Desktop nie jest uruchomiony |
| `port is already allocated` przy `docker compose up` | port 5432 zajmuje inny Postgres: w `.env` ustaw `DB_PORT=5433` i ten sam port w `DATABASE_URL` w `backend/.env` |
| `P1001: Can't reach database server` | baza nie działa: uruchom Docker Desktop, sprawdź `docker ps` |
| `P1000: Authentication failed` | hasło w `backend/.env` różni się od `.env`; jeśli hasło zmieniono po pierwszym starcie bazy, obowiązuje stare (albo usuń bazę: `docker compose down -v`, co kasuje dane) |
| backend nie wstaje: `JWT_SECRET nie jest ustawiony` | brak `JWT_SECRET` w `backend/.env` |
| `Cannot find module '../generated/prisma/client'` | nie wykonano `prisma generate` |
| „Coś poszło nie tak” przy logowaniu, `/health` zwraca `503` | backend nie ma połączenia z bazą (jak `P1001`) |
| „Brak połączenia z serwerem” w aplikacji | backend nie działa albo `EXPO_PUBLIC_API_URL` wskazuje zły adres |
| telefon (Expo Go) nie łączy się z backendem | w `app/.env` jest `localhost` zamiast adresu IPv4 komputera, Expo nie zostało uruchomione z `-c` po zmianie, telefon jest w innej sieci albo zapora Windows blokuje Node.js |
| `pnpm test:e2e` kończy się `AggregateError` w `globalSetup` | baza nie działa (Docker wyłączony) |
| `pnpm typecheck` nie widzi nowej trasy w aplikacji | typy tras powstają przy starcie Expo: uruchom `pnpm start` |
