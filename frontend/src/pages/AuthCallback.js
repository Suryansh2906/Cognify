import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';

// Reads session_id from the URL fragment, exchanges it for a session, then
// redirects into the app. Uses a ref-guard to survive StrictMode double-invoke.
export default function AuthCallback() {
  const nav = useNavigate();
  const location = useLocation();
  const hasProcessed = React.useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = location.hash || window.location.hash;
    const sid = new URLSearchParams(hash.replace('#', '')).get('session_id');
    if (!sid) {
      console.error('[auth] no session_id found in URL hash:', hash);
      toast.error('Login failed: no session ID returned. Try logging in again.');
      nav('/');
      return;
    }
    (async () => {
      try {
        const res = await api.post('/auth/session', { session_id: sid });
        // Store the token ourselves — don't rely on the browser accepting the
        // cross-origin Set-Cookie header, since Incognito/strict browsers
        // silently drop third-party cookies.
        if (res.data.session_token) {
          localStorage.setItem('session_token', res.data.session_token);
        }
        window.history.replaceState({}, '', '/dashboard');
        const onboarded = res.data.profile?.onboarded;
        nav(onboarded ? '/dashboard' : '/onboarding', { state: { user: res.data.user } });
      } catch (e) {
        console.error('[auth] session exchange failed:', {
          message: e.message,
          status: e.response?.status,
          data: e.response?.data,
          isNetworkError: !e.response,
        });
        const reason = !e.response
          ? 'Could not reach the server (network/CORS issue).'
          : e.response.status === 401
          ? 'Session was invalid or expired — try logging in again.'
          : `Server error (${e.response.status}): ${JSON.stringify(e.response.data)}`;
        toast.error(`Login failed: ${reason}`);
        nav('/');
      }
    })();
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted font-mono text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
