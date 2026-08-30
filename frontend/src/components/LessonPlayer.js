import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, ArrowClockwise, SkipForward, SkipBack, Gauge } from '@phosphor-icons/react';
import Avatar from './Avatar';
import SlideVisual from './SlideVisual';
import CheckpointModal from './CheckpointModal';
import useNarration from '../hooks/useNarration';

const SPEEDS = [0.75, 1, 1.25, 1.5];

export default function LessonPlayer({ plan, language, onEvaluate, onComplete, onLanguageSwitch }) {
  const segments = plan.segments || [];
  const [idx, setIdx] = useState(0);
  const [rate, setRate] = useState(1);
  const [narrationDone, setNarrationDone] = useState(false);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [answeredSegs, setAnsweredSegs] = useState({});
  const [cpPhase, setCpPhase] = useState('question'); // question | result | followup
  const [evaluation, setEvaluation] = useState(null);
  const [adaptation, setAdaptation] = useState(null);
  const [activeCheckpoint, setActiveCheckpoint] = useState(null);
  const [busy, setBusy] = useState(false);
  const advanceTimer = useRef(null);

  const { speak, pause, resume, stop, speaking, paused, amplitude, caption, activeVoice } = useNarration();
  const seg = segments[idx];

  const narrate = useCallback((segment) => {
    if (!segment) return;
    const provider = segment.tts_provider || 'web';
    setNarrationDone(false);
    speak(segment.script || '', {
      lang: language, provider, rate,
      onEnd: () => setNarrationDone(true),
    });
  }, [speak, language, rate]);

  // narrate whenever the segment index changes
  useEffect(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setShowCheckpoint(false);
    setEvaluation(null); setAdaptation(null); setCpPhase('question');
    narrate(seg);
    return () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); };
    // eslint-disable-next-line
  }, [idx, plan]);

  // when narration finishes: open checkpoint, auto-advance, or complete
  useEffect(() => {
    if (!narrationDone) return;
    if (seg?.checkpoint && !answeredSegs[idx]) {
      setActiveCheckpoint(seg.checkpoint);
      setCpPhase('question');
      setShowCheckpoint(true);
    } else if (idx < segments.length - 1) {
      advanceTimer.current = setTimeout(() => setIdx((i) => i + 1), 1400);
    } else {
      advanceTimer.current = setTimeout(() => onComplete(), 1800);
    }
    // eslint-disable-next-line
  }, [narrationDone]);

  const goTo = (i) => { if (i >= 0 && i < segments.length) { stop(); setIdx(i); } };
  const goToNext = () => {
    // never let a learner skip an unanswered checkpoint
    if (seg?.checkpoint && !answeredSegs[idx]) {
      stop();
      setActiveCheckpoint(seg.checkpoint);
      setCpPhase('question');
      setShowCheckpoint(true);
      return;
    }
    if (idx < segments.length - 1) goTo(idx + 1);
    else onComplete();
  };
  const replay = () => narrate(seg);
  const togglePlay = () => { if (speaking && !paused) pause(); else if (paused) resume(); else replay(); };
  const changeSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next);
  };

  const handleSubmit = async (answer) => {
    setBusy(true);
    const cp = activeCheckpoint;
    const wantAdapt = cpPhase !== 'followup';
    try {
      const { evaluation: ev, adaptation: ad } = await onEvaluate({
        question: cp.question, answer, concept: cp.concept || seg.concept,
        correct: cp.answer || '', adapt: wantAdapt,
      });
      setEvaluation(ev);
      setAdaptation(wantAdapt ? ad : null);
      setCpPhase('result');
      speak(ev.feedback || '', { lang: language, provider: 'web', rate });
    } catch (e) {
      setEvaluation({ verdict: 'partial', feedback: 'Could not evaluate right now. Let\'s continue.', misconception: '' });
      setCpPhase('result');
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = () => {
    stop();
    if (adaptation && adaptation.followup && cpPhase === 'result') {
      // move to follow-up question
      setActiveCheckpoint({ ...adaptation.followup });
      setEvaluation(null);
      setCpPhase('followup');
      speak(adaptation.followup.question || '', { lang: language, provider: 'web', rate });
      return;
    }
    setAnsweredSegs((m) => ({ ...m, [idx]: true }));
    setShowCheckpoint(false);
    if (idx < segments.length - 1) setIdx((i) => i + 1);
    else onComplete();
  };

  const switchLang = async (lang) => {
    if (lang === language) return;
    stop();
    await onLanguageSwitch(lang, idx);
  };

  const progress = ((idx + (narrationDone ? 1 : 0.4)) / segments.length) * 100;

  return (
    <div className="fixed inset-0 bg-black flex flex-col" data-testid="lesson-player">
      {/* top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">{plan.topic}</div>
          <div className="font-heading font-bold truncate">{seg?.concept}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-muted mr-2" data-testid="active-voice">voice: {activeVoice}</div>
          <div className="flex rounded-full border border-border overflow-hidden">
            {['en', 'hi'].map((l) => (
              <button key={l} onClick={() => switchLang(l)} data-testid={`lang-${l}`}
                className={`px-3 py-1.5 text-sm font-semibold transition-colors ${language === l ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'}`}>
                {l === 'en' ? 'EN' : 'हिं'}
              </button>
            ))}
          </div>
          <button onClick={onComplete} className="btn-ghost !py-1.5 !px-4 text-sm" data-testid="finish-lesson-button">Finish</button>
        </div>
      </div>

      {/* progress */}
      <div className="h-1 bg-white/5">
        <motion.div className="h-full bg-primary glow-primary" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
      </div>

      {/* stage */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,34%)_minmax(0,66%)] overflow-hidden min-h-0">
        {/* avatar column */}
        <div className="relative flex flex-col items-center justify-center gap-6 p-6 border-r border-white/5 grid-bg">
          <Avatar amplitude={amplitude} speaking={speaking && !paused} size={260} />
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted mb-1">AI Teacher</div>
            <div className="font-mono text-xs text-muted">{seg?.subject} · {seg?.depth}</div>
          </div>
        </div>

        {/* slide column */}
        <div className="overflow-y-auto p-6 sm:p-10">
          <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-mono text-primary">SLIDE {idx + 1}/{segments.length}</span>
              <span className="text-[11px] font-mono text-muted">· visual: {seg?.visual_type}</span>
            </div>
            <h2 className="text-3xl font-heading font-black tracking-tight mb-2">{seg?.concept}</h2>
            <p className="text-muted mb-4">{seg?.objective}</p>
            {seg?.visual_reason && (
              <div className="inline-block glass rounded-full px-3 py-1 text-[11px] text-accent mb-5" data-testid="visual-reason" title="Which rule chose this visual">
                Why this visual: {seg.visual_reason}
              </div>
            )}
            {seg?.on_screen_text?.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {seg.on_screen_text.map((t, i) => (
                  <span key={i} className="bg-secondary/60 border border-border rounded-lg px-3 py-1.5 text-sm">{t}</span>
                ))}
              </div>
            )}
            <SlideVisual segment={seg} />
            {seg?.source_ref && seg.source_ref !== 'general knowledge' && (
              <div className="mt-6 text-xs font-mono text-muted">source: {seg.source_ref}</div>
            )}
          </motion.div>
        </div>
      </div>

      {/* captions */}
      <div className="px-6 py-3 border-t border-white/5 min-h-[52px] flex items-center justify-center">
        <p className="text-center text-sm sm:text-base text-foreground/90 max-w-3xl" data-testid="caption">{caption}</p>
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-3 px-6 py-4 glass border-t border-white/5">
        <button onClick={() => goTo(idx - 1)} disabled={idx === 0} data-testid="prev-button" className="btn-ghost !p-3 !rounded-full disabled:opacity-30"><SkipBack size={18} weight="fill" /></button>
        <button onClick={replay} data-testid="replay-button" className="btn-ghost !p-3 !rounded-full"><ArrowClockwise size={18} weight="bold" /></button>
        <button onClick={togglePlay} data-testid="play-pause-button" className="btn-primary !p-4 !rounded-full">
          {speaking && !paused ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}
        </button>
        <button onClick={goToNext} data-testid="next-button" className="btn-ghost !p-3 !rounded-full"><SkipForward size={18} weight="fill" /></button>
        <button onClick={changeSpeed} data-testid="speed-button" className="btn-ghost !py-3 !px-4 !rounded-full flex items-center gap-1 font-mono text-sm"><Gauge size={16} /> {rate}x</button>
      </div>

      {showCheckpoint && (
        <CheckpointModal
          checkpoint={activeCheckpoint}
          phase={cpPhase}
          evaluation={evaluation}
          adaptation={adaptation}
          busy={busy}
          onSubmit={handleSubmit}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
