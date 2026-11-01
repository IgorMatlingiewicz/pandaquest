# PandaQuest

Gamifikowany system zarządzania produktywnością: praca inżynierska.

Użytkownik prowadzi zadania dzienne, tygodniowe, życiowe i poboczne w kategoriach. Za ich wykonywanie dostaje punkty doświadczenia (XP), poziomy, mnożnik za serie oraz odznaki. Aplikacja działa na telefonie i w przeglądarce, po polsku i po angielsku.

## Struktura repozytorium

| Katalog | Zawartość |
| --- | --- |
| `app/` | aplikacja kliencka: Expo (React Native), Expo Router, Gluestack UI, NativeWind, i18next |
| `backend/` | API: NestJS, Prisma, PostgreSQL, uwierzytelnianie JWT |
| katalog główny | baza w Dockerze (`docker-compose.yml`) i hook przed commitem (husky, lint-staged) |

`app/` i `backend/` to osobne projekty pnpm, każdy ma własne zależności i lockfile.

## Wymagania

- Node.js 24
- pnpm: dowolna wersja, projekt sam przełącza się na przypiętą 11.25.0
- Docker Desktop
- opcjonalnie Expo Go na telefonie

## Uruchomienie

Komendy działają w PowerShellu i w Bashu. Każdą sekcję wykonuj od katalogu głównego repozytorium.

### 1. Baza danych

Uruchom Docker Desktop, a potem:

```bash
cp .env.example .env
docker compose up -d
```

W pliku `.env` ustaw własne hasło. Kontener nazywa się `pandaquest-db` i nasłuchuje na porcie 5432.

### 2. Backend

```bash
cd backend
cp .env.example .env
pnpm install
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
pnpm start:dev
```

W `backend/.env` ustaw `DATABASE_URL` z tymi samymi danymi co w `.env` oraz własny `JWT_SECRET`. Plik `.env.example` opisuje, jak go wygenerować.

Klient Prisma nie jest przechowywany w repozytorium, dlatego `prisma generate` jest osobnym krokiem. Każda komenda Prismy wymaga `--config prisma7.config.ts`.

Sprawdzenie: `http://localhost:3000/health` zwraca `{"status":"ok"}`. Odpowiedź `503` oznacza, że backend nie ma połączenia z bazą.

### 3. Aplikacja

W drugim terminalu:

```bash
cd app
cp .env.example .env
pnpm install
pnpm start
```

Klawisz `w` otwiera aplikację w przeglądarce. Na telefonie zeskanuj kod QR w Expo Go, a w `app/.env` ustaw adres LAN komputera zamiast `localhost` (opis jest w `.env.example`). Telefon i komputer muszą być w tej samej sieci.

Konto załóż na ekranie rejestracji. Domyślne kategorie i przykładowe zadania tworzą się automatycznie.

## Testy i jakość kodu

| Gdzie | Komenda | Co sprawdza |
| --- | --- | --- |
| `backend/` | `pnpm test` | testy jednostkowe i scenariuszowe (Jest) |
| `backend/` | `pnpm test:mutation` | jakość testów logiki odznak i ciągów (StrykerJS), raport w `reports/mutation/` |
| `backend/` | `pnpm lint` | ESLint z automatycznymi poprawkami |
| `app/` | `pnpm test` | logika widoku i kolejka nagród (jest-expo, `app/__tests__/`) |
| `app/` | `pnpm typecheck` | typy TypeScript |
| `app/` | `pnpm lint` | ESLint |

Testy backendu nie wymagają działającej bazy: używają atrapy w pamięci (`backend/src/testing/fake-prisma.ts`).

Typy Expo powstają przy pierwszym `pnpm start`. Bez uruchamiania aplikacji, np. na świeżym klonie, wygeneruje je komenda `npx expo customize tsconfig.json` w katalogu `app/`. Bez nich `pnpm typecheck` zgłasza błąd `Cannot find name 'process'`.

Hook przed commitem uruchamia ESLint i Prettier na dodanych plikach `.ts` i `.tsx`, więc może je przy okazji sformatować.

## Najczęstsze problemy

| Objaw | Przyczyna i rozwiązanie |
| --- | --- |
| „Coś poszło nie tak” przy logowaniu, `/health` zwraca `503` | baza nie działa: uruchom Docker Desktop, sprawdź `docker ps` |
| „Brak połączenia z serwerem” | backend nie działa albo `EXPO_PUBLIC_API_URL` wskazuje zły adres |
| `P1001: Can't reach database server` | jak wyżej, baza nie działa |
| `Cannot find module '../generated/prisma/client'` | nie wykonano `prisma generate` |
| `pnpm typecheck` nie widzi nowej trasy w aplikacji | typy tras powstają przy starcie Expo: uruchom `pnpm start` |
