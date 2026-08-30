import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import api from '../lib/api';
import { CheckCircle, XCircle, Trophy, ArrowRight, Lightbulb } from '@phosphor-icons/react';

export default function Assessment() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [report, setReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.post(`/sessions/${sessionId}/assessment`).then((r) => setQuestions(r.data.questions))
      .catch(() => setError(true));
  }, [sessionId]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await api.post(`/sessions/${sessionId}/report`, { answers });
      setReport(r.data);
    } catch (e) {
      toast.error(e?.response?.status === 503 ? 'AI service temporarily unavailable, please retry' : 'Grading failed');
    } finally { setSubmitting(false); }
  };

  if (error) return <Center>Could not load the assessment. <button onClick={() => nav('/dashboard')} className="btn-primary mt-4">Dashboard</button></Center>;
  if (!questions) return <Center><div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" /><span className="font-mono text-sm text-muted">Building your quiz…</span></Center>;

  if (report) {
    const score = report.score || 0;
    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto py-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} data-testid="report-view">
          <div className="bg-card border border-border rounded-2xl p-8 text-center mb-6">
            <Trophy size={40} weight="fill" className="text-primary mx-auto mb-3" />
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted mb-2">Your score</div>
            <div className="font-mono text-6xl font-black text-primary mb-1" data-testid="report-score">{score}%</div>
            <div className="text-muted">{report.topic}</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5 mb-6">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-green-400 mb-3"><CheckCircle size={18} weight="fill" /><span className="font-heading font-bold">Strong areas</span></div>
              {report.strong_areas?.length ? report.strong_areas.map((s, i) => <div key={i} className="text-sm mb-1">• {s}</div>) : <div className="text-sm text-muted">—</div>}
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-red-400 mb-3"><XCircle size={18} weight="fill" /><span className="font-heading font-bold">Weak areas</span></div>
              {report.weak_areas?.length ? report.weak_areas.map((s, i) => <div key={i} className="text-sm mb-1">• {s}</div>) : <div className="text-sm text-muted">None — great job!</div>}
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 text-accent mb-2"><Lightbulb size={18} weight="fill" /><span className="font-heading font-bold">Recommended next step</span></div>
            <p className="text-base mb-3">{report.recommendation}</p>
            {report.next_topic && <div className="text-sm text-muted">Suggested next topic: <span className="text-foreground font-semibold">{report.next_topic}</span></div>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => nav('/dashboard')} className="btn-ghost flex-1" data-testid="report-dashboard-button">Go to dashboard</button>
            {report.next_topic && (
              <button onClick={() => nav('/new', { state: { topic: report.next_topic } })} className="btn-primary flex-1 flex items-center justify-center gap-2" data-testid="report-next-button">
                Learn {report.next_topic.length > 22 ? report.next_topic.slice(0, 22) + '…' : report.next_topic} <ArrowRight size={16} weight="bold" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto py-12" data-testid="assessment-view">
      <h1 className="text-4xl font-heading font-black tracking-tight mb-2">Final assessment</h1>
      <p className="text-muted mb-8">Answer these to get your report. Based only on what you were taught.</p>
      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-card border border-border rounded-2xl p-5" data-testid={`question-${q.id}`}>
            <div className="text-[11px] font-mono text-primary mb-2">Q{i + 1} · {q.type}</div>
            <div className="font-semibold mb-4">{q.question}</div>
            {q.type === 'mcq' && q.options?.length ? (
              <div className="space-y-2">
                {q.options.map((opt, j) => (
                  <button key={j} onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    data-testid={`q${q.id}-opt${j}`}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${answers[q.id] === opt ? 'border-primary bg-primary/10' : 'border-border hover:border-zinc-600'}`}>
                    <span className="font-mono text-muted mr-2">{String.fromCharCode(65 + j)}</span>{opt}
                  </button>
                ))}
              </div>
            ) : (
              <textarea rows={2} value={answers[q.id] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                data-testid={`q${q.id}-input`} placeholder="Your answer" />
            )}
          </div>
        ))}
      </div>
      <button onClick={submit} disabled={submitting} className="btn-primary w-full mt-6 text-base" data-testid="submit-assessment-button">
        {submitting ? 'Grading…' : 'Submit & get my report'}
      </button>
    </div>
  );
}

function Center({ children }) {
  return <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">{children}</div>;
}
