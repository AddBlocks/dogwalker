import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [paseador, setPaseador] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setPaseador(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api("/api/auth/me");
      setUser(data.user);
      setPaseador(data.paseador);
      setGoogleConfigured(data.googleConfigured);
    } catch {
      setToken(null);
      setUser(null);
      setPaseador(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(
    () => ({
      user,
      paseador,
      loading,
      googleConfigured,
      async login(email, password) {
        const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        setToken(data.token);
        await refresh();
        return data.user;
      },
      async registro(payload) {
        const data = await api("/api/auth/registro", { method: "POST", body: JSON.stringify(payload) });
        setToken(data.token);
        await refresh();
        return data.user;
      },
      logout() {
        setToken(null);
        setUser(null);
        setPaseador(null);
      },
      refresh,
    }),
    [user, paseador, loading, googleConfigured]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
