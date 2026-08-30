import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, House, ChartLineUp, BookOpen, SignOut, Plus } from '@phosphor-icons/react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const link = (to, label, Icon) => {
    const active = loc.pathname === to;
    return (
      <Link to={to} data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-colors ${active ? 'bg-secondary text-foreground' : 'text-muted hover:text-foreground'}`}>
        <Icon size={18} weight={active ? 'fill' : 'regular'} /> <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="brand-logo">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center glow-primary">
              <GraduationCap size={22} weight="fill" className="text-primary-foreground" />
            </div>
            <span className="font-heading font-black text-lg tracking-tight">AI Teacher</span>
          </Link>
          <nav className="flex items-center gap-1">
            {link('/dashboard', 'Dashboard', House)}
            {link('/new', 'New Lesson', Plus)}
            {link('/paths', 'Paths', ChartLineUp)}
            {link('/docs', 'Docs', BookOpen)}
          </nav>
          <div className="flex items-center gap-3">
            {user?.picture && <img src={user.picture} alt="me" className="h-8 w-8 rounded-full border border-border" />}
            <button onClick={logout} data-testid="logout-button" className="btn-ghost !px-3 !py-2 text-sm flex items-center gap-1">
              <SignOut size={16} /> <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
