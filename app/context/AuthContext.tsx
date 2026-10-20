import { createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getToken, setToken, removeToken } from "@/lib/tokenStorage";

import { API_URL } from "@/constants/api";

// Computed by the backend; the app never derives a level from XP itself.
type LevelProgress = {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  isMax: boolean;
};

export type User = {
  id: string;
  email: string;
  username: string;
  xpTotal: number;
  level: number;
  levelProgress: LevelProgress;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the profile and returns it; null when that failed. */
  refreshUser: () => Promise<User | null>;
};

// IANA name of the device timezone; the backend uses it to decide when
// daily/weekly tasks reset.
function getDeviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    async function loadStoredToken() {
      const stored = await getToken();
      if (stored) {
        const me = await fetchMe(stored);
        if (me) setTokenState(stored);
      }
      setIsLoading(false);
    }
    loadStoredToken();
  }, []);

  async function fetchMe(authToken: string): Promise<User | null> {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) return null;
      const data: User = await response.json();
      setUser(data);
      return data;
    } catch {
      return null;
    }
  }

  // Re-reads the profile, e.g. after the server awarded XP.
  async function refreshUser() {
    return token ? fetchMe(token) : null;
  }

  async function login(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        timezone: getDeviceTimezone(),
      }),
    });
    if (!response.ok) {
      throw new Error(t("auth.login.invalidCredentials"));
    }
    const data = await response.json();
    await setToken(data.accessToken);
    setTokenState(data.accessToken);
    await fetchMe(data.accessToken);
  }

  async function register(email: string, username: string, password: string) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        username,
        password,
        timezone: getDeviceTimezone(),
      }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || t("auth.register.failed"));
    }
    await login(email, password);
  }

  async function logout() {
    await removeToken();
    setTokenState(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading,
        register,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth musi być użyty wewnątrz AuthProvider");
  return ctx;
}
