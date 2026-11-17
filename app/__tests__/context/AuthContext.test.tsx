import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { fakeServer, type PendingRequest } from "../hooks/fake-server";

const mockLanguage = { current: "pl" };

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mockLanguage.current },
  }),
}));
jest.mock("@/lib/tokenStorage", () => ({
  getToken: jest.fn(async () => null),
  setToken: jest.fn(async () => {}),
  removeToken: jest.fn(async () => {}),
}));

describe("AuthProvider: signing up", () => {
  let server: PendingRequest[];

  beforeEach(() => {
    server = fakeServer();
  });

  /** Signs up, and returns what the app sent to POST /auth/register. */
  async function signUpWithAppIn(language: string) {
    mockLanguage.current = language;
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let done: Promise<void> | undefined;
    act(() => {
      done = result.current.register("new@example.com", "Panda", "haslo123");
    });
    const sent = JSON.parse(server[0].init!.body as string) as Record<
      string,
      unknown
    >;

    // Let the sign-up finish: register, login, then /auth/me.
    await server[0].succeed({ id: "user-1" }, 201);
    await server[1].succeed({ accessToken: "token" }, 201);
    await server[2].succeed({ id: "user-1", tutorialStatus: "NOT_STARTED" });
    await act(() => done!);
    return sent;
  }

  it.each(["pl", "en"])(
    "sends the app's language (%s) with the sign-up",
    async (language) => {
      const sent = await signUpWithAppIn(language);

      expect(server[0].url).toMatch(/\/auth\/register$/);
      expect(sent).toMatchObject({
        email: "new@example.com",
        username: "Panda",
        language,
      });
    },
  );
});
