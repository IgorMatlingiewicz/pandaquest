import { renderHook } from "@testing-library/react-native";
import { usePathname } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  FriendsSummaryProvider,
  useFriendsSummary,
} from "@/context/FriendsSummaryContext";
import { fakeServer, type PendingRequest } from "../hooks/fake-server";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("expo-router", () => ({ usePathname: jest.fn() }));

const summary = (pendingIncomingCount: number) => ({
  friendsCount: 1,
  pendingIncomingCount,
});

describe("FriendsSummaryProvider", () => {
  let server: PendingRequest[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ token: "token" } as never);
    jest.mocked(usePathname).mockReturnValue("/");
    server = fakeServer();
  });

  const reads = () => server.filter((r) => r.url.endsWith("/friends/summary"));
  const render = () =>
    renderHook(() => useFriendsSummary(), { wrapper: FriendsSummaryProvider });

  it("starts at 0 and shows the count once it comes", async () => {
    const { result } = render();

    expect(result.current.pendingIncoming).toBe(0);
    expect(reads()[0].init).toEqual({
      headers: { Authorization: "Bearer token" },
    });
    await reads()[0].succeed(summary(2));

    expect(result.current.pendingIncoming).toBe(2);
  });

  it("reads again on every page change, and only then", async () => {
    const { rerender } = render();
    await reads()[0].succeed(summary(0));

    rerender({});
    expect(reads()).toHaveLength(1);

    jest.mocked(usePathname).mockReturnValue("/streaks");
    rerender({});
    expect(reads()).toHaveLength(2);
    await reads()[1].succeed(summary(0));
  });

  it("reads again when asked to, after an action", async () => {
    const { result } = render();
    await reads()[0].succeed(summary(1));

    result.current.refresh();
    await reads()[1].succeed(summary(0));

    expect(result.current.pendingIncoming).toBe(0);
  });

  it("keeps the last count when a read fails", async () => {
    const { result } = render();
    await reads()[0].succeed(summary(3));

    result.current.refresh();
    await reads()[1].drop();

    expect(result.current.pendingIncoming).toBe(3);
  });

  it("ignores an older answer that comes back after a newer one", async () => {
    const { result } = render();
    result.current.refresh();

    await reads()[1].succeed(summary(0));
    await reads()[0].succeed(summary(5));

    expect(result.current.pendingIncoming).toBe(0);
  });

  it("sends nothing when nobody is logged in", () => {
    jest.mocked(useAuth).mockReturnValue({ token: null } as never);
    render();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses to work outside its provider", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useFriendsSummary())).toThrow(
      "FriendsSummaryProvider",
    );
  });
});
