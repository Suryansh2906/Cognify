import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { GraduationCap } from '@phosphor-icons/react';

export default function Onboarding() {
  const { profile, checkAuth } = useAuth();
  const nav = useNavigate();
  const [level, setLevel] = useState('beginner');
  const [langs, setLangs] = useState(['en']);
  const [style, setStyle] = useState('clear and friendly with simple examples');
  const [goals, setGoals] = useState('');
  const [saving, setSaving] = useState(false);

  if (profile?.onboarded) { nav('/dashboard'); return null; }

  const toggleLang = (l) => setLangs((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/profile/onboarding', {
        default_level: level, preferred_languages: langs.length ? langs : ['en'],
        preferred_style: style, goals,
      });
      await checkAuth();
      toast.success('Profile ready. Let\'s learn!');
      nav('/new');
    } catch (e) { toast.error('Could not save profile'); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-8" data-testid="onboarding-form">
        <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center glow-primary mb-6">
          <GraduationCap size={24} weight="fill" className="text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-heading font-black tracking-tight mb-1">Set up your learning</h1>
        <p className="text-muted mb-8">This personalizes every lesson we build for you.</p>

        <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Default level</label>
        <div className="grid grid-cols-3 gap-2 mt-2 mb-6">
          {['beginner', 'intermediate', 'advanced'].map((l) => (
            <button key={l} onClick={() => setLevel(l)} data-testid={`level-${l}`}
              className={`py-2 rounded-xl border capitalize text-sm transition-colors ${level === l ? 'border-primary bg-primary/10' : 'border-border'}`}>{l}</button>
          ))}
        </div>

        <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Languages</label>
        <div className="grid grid-cols-2 gap-2 mt-2 mb-6">
          {[['en', 'English'], ['hi', 'हिंदी Hindi']].map(([v, n]) => (
            <button key={v} onClick={() => toggleLang(v)} data-testid={`onb-lang-${v}`}
              className={`py-2 rounded-xl border text-sm transition-colors ${langs.includes(v) ? 'border-primary bg-primary/10' : 'border-border'}`}>{n}</button>
          ))}
        </div>

        <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Preferred style</label>
        <input value={style} onChange={(e) => setStyle(e.target.value)} className="mt-2 mb-6" data-testid="style-input" />

        <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Learning goals (optional)</label>
        <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} className="mt-2 mb-8"
          placeholder="e.g. crack my Class 8 science exam" data-testid="goals-input" />

        <button onClick={save} disabled={saving} className="btn-primary w-full" data-testid="save-onboarding-button">
          {saving ? 'Saving…' : 'Start learning'}
        </button>
      </div>
    </div>
  );
}
