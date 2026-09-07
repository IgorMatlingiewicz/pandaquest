import { createContext, useContext, useEffect, useState } from "react";
import { getToken, setToken, removeToken } from "@/lib/tokenStorage";

const API_URL = "http://192.168.0.152:3000";

type User = {
  id: string;
  email: string;
  username: string;
  xpTotal: number;
  level: number;
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
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredToken() {
      const stored = await getToken();
      if (stored) {
        const valid = await fetchMe(stored);
        if (valid) setTokenState(stored);
      }
      setIsLoading(false);
    }
    loadStoredToken();
  }, []);

  async function fetchMe(authToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) return false;
      const data = await response.json();
      setUser(data);
      return true;
    } catch {
      return false;
    }
  }

  async function login(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error("Nieprawidłowy email lub hasło");
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
      body: JSON.stringify({ email, username, password }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Rejestracja nie powiodła się");
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
      value={{ token, user, isLoading, register, login, logout }}
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
