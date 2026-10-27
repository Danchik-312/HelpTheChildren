import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, setCsrfToken, subscribeUnauthorized } from '../api/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const clearSession = useCallback(() => {
    setCsrfToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const restoreSession = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await apiRequest('/auth/session');
      setCsrfToken(data.csrfToken);
      setUser(data.user);
      setStatus('authenticated');
    } catch (error) {
      clearSession();
      if (error.status !== 401) throw error;
    }
  }, [clearSession]);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeUnauthorized(() => active && clearSession());
    restoreSession().catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, [clearSession, restoreSession]);

  const login = useCallback(async credentials => {
    const data = await apiRequest('/auth/login', { method: 'POST', body: credentials });
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const hasArea = useCallback(area => user?.role === 'ADMIN' || Boolean(user?.permissions?.some(item => item.area === area)), [user]);
  const canPublish = useCallback(area => user?.role === 'ADMIN' || Boolean(user?.permissions?.some(item => item.area === area && item.canPublish)), [user]);
  const value = useMemo(() => ({ user, status, login, logout, hasArea, canPublish }), [user, status, login, logout, hasArea, canPublish]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth должен использоваться внутри AuthProvider');
  return value;
}
