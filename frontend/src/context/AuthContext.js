import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setProfile(res.data.profile);
    } catch (e) {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If returning from OAuth callback, let AuthCallback establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async () => {
  try {
    const res = await api.post('/auth/guest');
    if (res.data.session_token) {
      localStorage.setItem('session_token', res.data.session_token);
    }
    setUser(res.data.user);
    setProfile(res.data.profile);
    window.location.href = res.data.profile?.onboarded ? '/dashboard' : '/onboarding';
  } catch (e) {
    console.error('[auth] guest login failed:', e);
    toast.error('Could not start a session. Please try again.');
  }
};

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch (e) { /* ignore */ }
    localStorage.removeItem('session_token');
    setUser(null);
    setProfile(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, checkAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
