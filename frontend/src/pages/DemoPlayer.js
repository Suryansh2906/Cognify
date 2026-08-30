import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../lib/api';
import LessonPlayer from '../components/LessonPlayer';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, GraduationCap } from '@phosphor-icons/react';

// Public demo: teaches the seed lesson with zero setup. Checkpoints are graded
// locally (no auth / no LLM needed) so it always works as a live fallback.
function localGrade(cp, answer) {
  const a = (answer || '').trim().toLowerCase();
  const correct = (cp.answer || '').toLowerCase();
  let ok;
  if (cp.type === 'mcq') ok = a === correct;
  else {
    const keys = correct.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const hits = keys.filter((k) => a.includes(k)).length;
    ok = keys.length ? hits / keys.length >= 0.4 : a.length > 8;
  }
  return {
    verdict: ok ? 'correct' : 'incorrect',
    feedback: ok ? 'Well done — that is right.' : `Not quite. The key idea: ${cp.answer}`,
    misconception: ok ? '' : 'Review this concept and try to connect it to the example shown.',
  };
}

export default function DemoPlayer() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [language, setLanguage] = useState('en');
  const [done, setDone] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => { api.get('/demo/lesson').then((r) => setPlan(r.data)).catch(() => {}); }, []);

  const onEvaluate = async ({ question, answer, concept, correct }) => {
    const cp = plan.segments.map((s) => s.checkpoint).find((c) => c && c.question === question) || { answer: correct, type: 'short' };
    const ev = localGrade(cp, answer);
    setResults((r) => [...r, { concept, correct: ev.verdict === 'correct' }]);
    return { evaluation: ev, adaptation: null };
  };

  const onLanguageSwitch = async (lang) => { setLanguage(lang); };

  if (done) {
    const score = results.length ? Math.round((results.filter((r) => r.correct).length / results.length) * 100) : 100;
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-card border border-border rounded-2xl p-8 text-center" data-testid="demo-complete">
          <CheckCircle size={44} weight="fill" className="text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-heading font-black mb-2">Demo complete!</h1>
          <p className="text-muted mb-1">You answered {results.filter((r) => r.correct).length}/{results.length} checkpoints correctly.</p>
          <div className="font-mono text-5xl font-black text-primary my-6">{score}%</div>
          <p className="text-sm text-muted mb-8">Sign in to build your own lessons, get graded assessments, and track progress over time.</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => nav(user ? '/new' : '/')} className="btn-primary" data-testid="demo-cta-signin">
              {user ? 'Build your own lesson' : 'Sign in to start'}
            </button>
            <button onClick={() => { setDone(false); setResults([]); window.location.reload(); }} className="btn-ghost" data-testid="demo-replay">Replay demo</button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!plan) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <GraduationCap size={40} weight="fill" className="text-primary mx-auto mb-4 animate-pulse" />
        <p className="text-muted font-mono text-sm">Loading demo lesson…</p>
      </div>
    </div>
  );

  return <LessonPlayer plan={plan} language={language} onEvaluate={onEvaluate}
    onLanguageSwitch={onLanguageSwitch} onComplete={() => setDone(true)} />;
}
