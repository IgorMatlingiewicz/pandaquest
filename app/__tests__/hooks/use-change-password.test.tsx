import { act, renderHook } from "@testing-library/react-native";
import { useAuth } from "@/context/AuthContext";
import { useChangePassword } from "@/hooks/use-change-password";
import type { PasswordFailure } from "@/lib/api-errors";
import { fakeServer, type PendingRequest } from "./fake-server";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

describe("useChangePassword", () => {
  const logout = jest.fn();
  let server: PendingRequest[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ token: "token", logout } as never);
    server = fakeServer();
  });

  const start = () => {
    const hook = renderHook(() => useChangePassword());
    let outcome: Promise<PasswordFailure | null> | undefined;
    act(() => {
      outcome = hook.result.current.submit("haslo123", "nowehaslo1");
    });
    return { ...hook, outcome: () => outcome };
  };

  it("sends both passwords with the token and resolves to null on a 204", async () => {
    const { result, outcome } = start();

    expect(server[0].url).toMatch(/\/auth\/password$/);
    expect(server[0].init).toMatchObject({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
    });
    expect(JSON.parse(server[0].init!.body as string)).toEqual({
      currentPassword: "haslo123",
      newPassword: "nowehaslo1",
    });
    expect(result.current.saving).toBe(true);

    // No body: reading one would fail, so success must not read it.
    await server[0].succeed(undefined, 204);

    await expect(outcome()).resolves.toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it.each([
    [403, { field: "current", key: "profile.password.wrongCurrent" }],
    [400, { field: "next", key: "profile.password.tooWeak" }],
    [409, { field: "next", key: "profile.password.sameAsCurrent" }],
    [401, { field: "form", key: "common.sessionExpired" }],
    [500, { field: "form", key: "common.genericError" }],
  ])(
    "shows a %i where it belongs and does not log out",
    async (status, failure) => {
      const { result, outcome } = start();

      await server[0].refuse(status);

      await expect(outcome()).resolves.toEqual(failure);
      expect(result.current.saving).toBe(false);
      expect(logout).not.toHaveBeenCalled();
    },
  );

  it("calls no answer a connection problem and does not log out", async () => {
    const { outcome } = start();

    await server[0].drop();

    await expect(outcome()).resolves.toEqual({
      field: "form",
      key: "common.noConnection",
    });
    expect(logout).not.toHaveBeenCalled();
  });

  it("sends a form submitted twice once, and both get its outcome", async () => {
    const { result, outcome } = start();
    let second: Promise<PasswordFailure | null> | undefined;
    act(() => {
      second = result.current.submit("haslo123", "nowehaslo1");
    });

    expect(server).toHaveLength(1);
    await server[0].refuse(403);

    const failure = { field: "current", key: "profile.password.wrongCurrent" };
    await expect(outcome()).resolves.toEqual(failure);
    await expect(second).resolves.toEqual(failure);
  });

  it("sends again once the first attempt is answered", async () => {
    const { result } = start();
    await server[0].refuse(403);

    act(() => {
      result.current.submit("haslo1234", "nowehaslo1");
    });

    expect(server).toHaveLength(2);
    expect(JSON.parse(server[1].init!.body as string).currentPassword).toBe(
      "haslo1234",
    );
  });
});
