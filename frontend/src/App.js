import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthCallback from './pages/AuthCallback';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import NewLesson from './pages/NewLesson';
import Player from './pages/Player';
import DemoPlayer from './pages/DemoPlayer';
import Assessment from './pages/Assessment';
import Dashboard from './pages/Dashboard';
import Paths from './pages/Paths';
import Docs from './pages/Docs';
import AdminDebug from './pages/AdminDebug';

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes('session_id=')) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<DemoPlayer />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/new" element={<Protected><NewLesson /></Protected>} />
      <Route path="/player/:planId" element={<Protected><Player /></Protected>} />
      <Route path="/assessment/:sessionId" element={<Protected><Assessment /></Protected>} />
      <Route path="/paths" element={<Protected><Paths /></Protected>} />
      <Route path="/admin" element={<Protected><AdminDebug /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-center" richColors />
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}
