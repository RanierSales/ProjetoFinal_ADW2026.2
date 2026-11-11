import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import http from '../api/http';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('token')); // validando token salvo

  // Ao abrir o site, recupera a sessão a partir do token salvo.
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    http
      .get('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const expirou = () => setUser(null);
    window.addEventListener('auth:expired', expirou);
    return () => window.removeEventListener('auth:expired', expirou);
  }, []);

  const guardar = useCallback(({ token, user: u }) => {
    localStorage.setItem('token', token);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(async (email, senha) => guardar((await http.post('/auth/login', { email, senha })).data), [guardar]);
  const register = useCallback(async (dados) => guardar((await http.post('/auth/register', dados)).data), [guardar]);
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, isAdmin: user?.role === 'admin' }),
    [user, loading, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
