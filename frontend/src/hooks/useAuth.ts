import { useState, useEffect, useCallback } from "react";
import { authApi, getToken, setToken, clearToken, type User } from "@/lib/api";

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  loading: boolean;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: !!getToken(),
    user: (() => {
      try { return JSON.parse(localStorage.getItem("insurgo_user") || "null"); } catch { return null; }
    })(),
    loading: false,
  });

  // Re-check auth on storage changes (e.g. other tabs)
  useEffect(() => {
    const handler = () => {
      setState((s) => ({ ...s, isLoggedIn: !!getToken() }));
    };
    window.addEventListener("storage", handler);
    window.addEventListener("auth-change", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("auth-change", handler);
    };
  }, []);

  // Refresh user profile if we have a token but no user data
  useEffect(() => {
    if (getToken() && !state.user) {
      authApi.getMe()
        .then(({ data }) => {
          localStorage.setItem("insurgo_user", JSON.stringify(data.user));
          setState((s) => ({ ...s, user: data.user }));
        })
        .catch(() => {
          // Token expired — clear it
          clearToken();
          setState({ isLoggedIn: false, user: null, loading: false });
        });
    }
  }, []);

  const login = useCallback(async (phone: string, password: string): Promise<User> => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const { token, data } = await authApi.login(phone, password);
      setToken(token);
      localStorage.setItem("insurgo_user", JSON.stringify(data.user));
      // Keep legacy key so Navbar still works
      localStorage.setItem("insurgo_auth", "true");
      setState({ isLoggedIn: true, user: data.user, loading: false });
      window.dispatchEvent(new Event("auth-change"));
      return data.user;
    } catch (err) {
      setState((s) => ({ ...s, loading: false }));
      throw err;
    }
  }, []);

  const register = useCallback(async (payload: Parameters<typeof authApi.register>[0]): Promise<User> => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const { token, data } = await authApi.register(payload);
      setToken(token);
      localStorage.setItem("insurgo_user", JSON.stringify(data.user));
      localStorage.setItem("insurgo_auth", "true");
      setState({ isLoggedIn: true, user: data.user, loading: false });
      window.dispatchEvent(new Event("auth-change"));
      return data.user;
    } catch (err) {
      setState((s) => ({ ...s, loading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem("insurgo_auth");
    setState({ isLoggedIn: false, user: null, loading: false });
    window.dispatchEvent(new Event("auth-change"));
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    const { data } = await authApi.getMe();
    localStorage.setItem("insurgo_user", JSON.stringify(data.user));
    setState((s) => ({ ...s, user: data.user }));
    return data.user;
  }, []);

  return { ...state, login, register, logout, refreshUser };
};
