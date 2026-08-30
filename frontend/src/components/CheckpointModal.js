import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Microphone, CheckCircle, XCircle, WarningCircle, ArrowRight } from '@phosphor-icons/react';

const VERDICT = {
  correct: { icon: CheckCircle, color: '#4ade80', label: 'Correct' },
  partial: { icon: WarningCircle, color: '#facc15', label: 'Partially correct' },
  incorrect: { icon: XCircle, color: '#f87171', label: 'Not quite' },
};

export default function CheckpointModal({ checkpoint, onSubmit, onContinue, phase, evaluation, adaptation, busy }) {
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);

  const cp = checkpoint || {};
  const isMcq = cp.type === 'mcq' && (cp.options || []).length > 0;

  const startSTT = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser.'); return; }
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.onresult = (e) => setAnswer((prev) => (prev ? prev + ' ' : '') + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  const submit = () => {
    if (!answer.trim()) return;
    onSubmit(answer.trim());
  };

  const V = evaluation ? (VERDICT[evaluation.verdict] || VERDICT.partial) : null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-6 sm:p-8"
          data-testid="checkpoint-modal"
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}>

          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-3">
            {phase === 'followup' ? 'Follow-up Question' : 'Checkpoint'}
          </div>

          {/* Question + answer input */}
          {(phase === 'question' || phase === 'followup') && (
            <>
              <h3 className="text-xl sm:text-2xl font-heading font-bold mb-5" data-testid="checkpoint-question">{cp.question}</h3>
              {isMcq ? (
                <div className="space-y-2 mb-5">
                  {cp.options.map((opt, i) => (
                    <button key={i} onClick={() => setAnswer(opt)} data-testid={`option-${i}`}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${answer === opt ? 'border-primary bg-primary/10' : 'border-border hover:border-zinc-600'}`}>
                      <span className="font-mono text-muted mr-2">{String.fromCharCode(65 + i)}</span> {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="relative mb-5">
                  <textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)}
                    data-testid="answer-input" placeholder="Type your answer, or use the mic…" />
                  <button onClick={startSTT} data-testid="mic-button"
                    className={`absolute right-3 bottom-3 h-9 w-9 rounded-full flex items-center justify-center ${listening ? 'bg-accent text-accent-foreground animate-pulse' : 'bg-secondary'}`}>
                    <Microphone size={18} weight="fill" />
                  </button>
                </div>
              )}
              <button onClick={submit} disabled={busy || !answer.trim()} className="btn-primary w-full" data-testid="submit-answer-button">
                {busy ? 'Evaluating…' : 'Submit answer'}
              </button>
            </>
          )}

          {/* Evaluation result */}
          {phase === 'result' && evaluation && (
            <div data-testid="evaluation-result">
              <div className="flex items-center gap-2 mb-3" style={{ color: V.color }}>
                <V.icon size={26} weight="fill" />
                <span className="font-heading font-bold text-lg">{V.label}</span>
              </div>
              <p className="text-base leading-relaxed mb-3">{evaluation.feedback}</p>
              {evaluation.misconception && (
                <div className="glass rounded-xl p-3 mb-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-1">Misconception detected</div>
                  <div className="text-sm" data-testid="misconception-note">{evaluation.misconception}</div>
                </div>
              )}
              {adaptation && (
                <div className="border-t border-border pt-4 mb-4" data-testid="adaptation-block">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent mb-2">Let's look at it differently</div>
                  <p className="text-base leading-relaxed mb-2">{adaptation.script}</p>
                  {adaptation.analogy && <p className="text-sm text-muted italic">Analogy: {adaptation.analogy}</p>}
                </div>
              )}
              <button onClick={onContinue} className="btn-primary w-full flex items-center justify-center gap-2" data-testid="continue-button">
                {adaptation && adaptation.followup ? 'Try the follow-up' : 'Continue lesson'} <ArrowRight size={18} weight="bold" />
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
