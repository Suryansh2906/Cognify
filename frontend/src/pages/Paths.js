import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Path, Plus, CheckCircle, Circle, ArrowRight, Play } from '@phosphor-icons/react';

export default function Paths() {
  const nav = useNavigate();
  const [paths, setPaths] = useState([]);
  const [topic, setTopic] = useState('');
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = () => api.get('/profile').then((r) => setPaths(r.data.learning_paths || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!topic.trim()) return;
    setCreating(true);
    try {
      await api.post('/learning-paths', { topic, level: 'beginner', language: 'en' });
      setTopic('');
      toast.success('Learning path created');
      load();
    } catch (e) { toast.error(e?.response?.status === 503 ? 'AI busy, retry' : 'Failed'); }
    finally { setCreating(false); }
  };

  const advance = async (pathId) => {
    await api.post(`/learning-paths/${pathId}/advance`);
    load();
  };

  const learnStep = async (title) => {
    setStarting(true);
    try {
      const r = await api.post('/lessons/plan', { topic: title, level: 'beginner', language: 'en', time_budget_min: 20, days: 1 });
      if (r.data.plan_id) nav(`/player/${r.data.plan_id}`);
    } catch (e) { toast.error('Could not start lesson'); }
    finally { setStarting(false); }
  };

  return (
    <Layout>
      <h1 className="text-4xl font-heading font-black tracking-tight mb-2">Learning paths</h1>
      <p className="text-muted mb-8">For broad goals, get an ordered curriculum and learn step by step.</p>

      <div className="bg-card border border-border rounded-2xl p-5 mb-8 flex gap-3 flex-wrap" data-testid="create-path">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-1 !w-auto min-w-[200px]"
          placeholder="e.g. Machine Learning, Organic Chemistry, World War II" data-testid="path-topic-input" />
        <button onClick={create} disabled={creating} className="btn-primary flex items-center gap-2" data-testid="create-path-button">
          <Plus size={18} weight="bold" /> {creating ? 'Building…' : 'Build path'}
        </button>
      </div>

      <div className="space-y-6">
        {paths.map((pa) => {
          const currentStep = pa.steps.find((s) => s.status === 'current');
          return (
            <div key={pa.path_id} className="bg-card border border-border rounded-2xl p-6" data-testid={`path-${pa.path_id}`}>
              <div className="flex items-center gap-2 mb-5"><Path size={20} className="text-accent" weight="bold" /><h3 className="font-heading font-bold text-xl">{pa.topic}</h3></div>
              <div className="space-y-3">
                {pa.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {s.status === 'done' ? <CheckCircle size={22} weight="fill" className="text-green-400 shrink-0" />
                      : s.status === 'current' ? <Circle size={22} weight="fill" className="text-primary shrink-0" />
                      : <Circle size={22} className="text-muted shrink-0" />}
                    <div className="flex-1">
                      <div className={`font-semibold ${s.status === 'pending' ? 'text-muted' : ''}`}>{s.title}</div>
                      {s.detail && <div className="text-xs text-muted">{s.detail}</div>}
                    </div>
                    {s.status === 'current' && (
                      <div className="flex gap-2">
                        <button onClick={() => learnStep(s.title)} disabled={starting} className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1" data-testid="learn-step-button"><Play size={13} weight="fill" /> Learn</button>
                        <button onClick={() => advance(pa.path_id)} className="btn-ghost !py-1.5 !px-3 text-xs flex items-center gap-1" data-testid="advance-step-button">Done <ArrowRight size={13} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!paths.length && <p className="text-muted text-center py-10">No paths yet. Build one above.</p>}
      </div>
    </Layout>
  );
}
