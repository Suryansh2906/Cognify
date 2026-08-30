import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import LessonPlayer from '../components/LessonPlayer';

export default function Player() {
  const { planId } = useParams();
  const nav = useNavigate();
  const [plan, setPlan] = useState(null);
  const [language, setLanguage] = useState('en');
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.get(`/lessons/${planId}`);
        setPlan(p.data);
        setLanguage(p.data.language || 'en');
        const s = await api.post('/sessions/start', { plan_id: planId });
        setSessionId(s.data.session_id);
      } catch (e) { setError(true); }
    })();
  }, [planId]);

  const onEvaluate = async ({ question, answer, concept, correct, adapt }) => {
    const idx = plan.segments.findIndex((s) => (s.checkpoint?.question === question) || s.concept === concept);
    const r = await api.post(`/sessions/${sessionId}/evaluate`, {
      segment_index: idx < 0 ? 0 : idx, question, answer, concept, correct,
    });
    return { evaluation: r.data.evaluation, adaptation: adapt ? r.data.adaptation : null };
  };

  const onLanguageSwitch = async (lang, fromIndex) => {
    try {
      const r = await api.post(`/lessons/${planId}/translate`, { language: lang, from_index: fromIndex });
      setPlan((p) => ({ ...p, segments: r.data.segments, language: lang }));
      setLanguage(lang);
      toast.success(lang === 'hi' ? 'हिंदी में बदल गया' : 'Switched to English');
    } catch (e) { toast.error('Translation failed'); }
  };

  const onComplete = () => nav(`/assessment/${sessionId}`);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-center p-6">
      <div>
        <p className="text-xl font-heading font-bold mb-2">AI service temporarily unavailable</p>
        <p className="text-muted mb-6">We couldn't load this lesson. Please retry.</p>
        <button onClick={() => nav('/new')} className="btn-primary" data-testid="back-to-new">Back to new lesson</button>
      </div>
    </div>
  );
  if (!plan || !sessionId) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted font-mono text-sm">Preparing your lesson…</p>
      </div>
    </div>
  );

  return <LessonPlayer plan={plan} language={language} onEvaluate={onEvaluate}
    onLanguageSwitch={onLanguageSwitch} onComplete={onComplete} />;
}
