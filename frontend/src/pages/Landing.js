import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Play, Sparkle, Brain, ChartLineUp, Waveform, Globe } from '@phosphor-icons/react';

const HERO = 'https://images.unsplash.com/photo-1677442136019-21780ecad995?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600';

const FEATURES = [
  { icon: Brain, title: 'Real pedagogy loop', body: 'Plan → Explain → Demonstrate → Question → Evaluate → Adapt. It re-teaches when you get it wrong.' },
  { icon: Waveform, title: 'Avatar + voice lessons', body: 'A talking AI teacher with synced narration, captions, and subject-aware visuals — not a wall of text.' },
  { icon: Globe, title: 'English & Hindi', body: 'Switch language mid-lesson. Hinglish requests understood. Teach from material in another language.' },
  { icon: ChartLineUp, title: 'Assessed & personalized', body: 'End-of-lesson scoring, weak-area reports, and a profile that shapes your next lesson.' },
];

export default function Landing() {
  const { login, user } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen">
      {/* hero */}
      <section className="relative overflow-hidden min-h-[92vh] flex flex-col">
        <div className="absolute inset-0 bg-center bg-cover opacity-30" style={{ backgroundImage: `url(${HERO})` }} />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative max-w-7xl mx-auto px-6 pt-8 w-full flex-1 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center glow-primary">
                <GraduationCap size={22} weight="fill" className="text-primary-foreground" />
              </div>
              <span className="font-heading font-black text-lg">AI Teacher</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => nav('/docs')} data-testid="nav-docs-top" className="btn-ghost !py-2 !px-4 text-sm">Docs</button>
              <button onClick={login} data-testid="login-button" className="btn-primary !py-2 !px-5 text-sm">Sign in</button>
            </div>
          </div>

          <div className="py-24 sm:py-36 max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1 text-xs mb-6">
                <Sparkle size={14} weight="fill" className="text-primary" /> Adaptive · Multilingual · Grounded in your material
              </div>
              <h1 className="text-5xl sm:text-7xl font-heading font-black tracking-tighter leading-[0.95] mb-6">
                An AI that <span className="text-primary">teaches</span>, not just answers.
              </h1>
              <p className="text-lg sm:text-xl text-foreground/80 mb-9 max-w-2xl leading-relaxed">
                Upload a chapter or name a topic. AI Teacher plans the lesson, explains it with an avatar and voice,
                questions you along the way, catches your misconceptions, and reports how you did.
              </p>
              <div className="flex flex-wrap gap-4">
                <button onClick={() => nav('/demo')} data-testid="try-demo-button" className="btn-primary flex items-center gap-2 text-base">
                  <Play size={20} weight="fill" /> Try the live demo
                </button>
                <button onClick={user ? () => nav('/new') : login} data-testid="get-started-button" className="btn-ghost text-base">
                  {user ? 'Start a lesson' : 'Sign in to build a lesson'}
                </button>
              </div>
              <p className="text-xs text-muted mt-4 font-mono">Demo: Newton's Laws of Motion · no setup required</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-2xl p-6 hover:-translate-y-1 transition-transform">
              <f.icon size={30} weight="duotone" className="text-primary mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        <p className="font-mono">AI Teacher · Gemini → Groq → OpenRouter fallback · Web Speech / edge-tts / ElevenLabs</p>
      </footer>
    </div>
  );
}
