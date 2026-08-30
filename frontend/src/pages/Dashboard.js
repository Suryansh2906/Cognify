import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Brain, TrendUp, BookmarkSimple, Warning, Star, Plus, Path, Bug } from '@phosphor-icons/react';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => { api.get('/profile').then((r) => setData(r.data)).catch(() => {}); }, []);

  const p = data?.profile || profile || {};
  const reports = data?.reports || [];
  const lessons = data?.lessons || [];
  const paths = data?.learning_paths || [];
  const history = (p.score_history || []).map((h, i) => ({ name: `#${i + 1}`, score: h.score, topic: h.topic }));

  return (
    <Layout>
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted mb-1">Welcome back</div>
          <h1 className="text-4xl font-heading font-black tracking-tight">{user?.name || 'Learner'}</h1>
        </div>
        <button onClick={() => nav('/new')} className="btn-primary flex items-center gap-2" data-testid="dashboard-new-lesson"><Plus size={18} weight="bold" /> New lesson</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" data-testid="dashboard">
        {/* score chart */}
        <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4"><TrendUp size={18} className="text-primary" weight="bold" /><h3 className="font-heading font-bold">Score history</h3></div>
          {history.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#a1a1aa" fontSize={12} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                  formatter={(v, n, item) => [`${v}%`, item?.payload?.topic]} />
                <Line type="monotone" dataKey="score" stroke="#e3ff37" strokeWidth={3} dot={{ r: 4, fill: '#e3ff37' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty text="Complete a lesson to see your score history." />}
        </div>

        {/* stats */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-5">
          <Stat icon={BookmarkSimple} label="Topics" value={(p.topics_studied || []).length} />
          <Stat icon={Brain} label="Lessons" value={lessons.length} />
          <Stat icon={Star} label="Strengths" value={(p.strong_concepts || []).length} color="#4ade80" />
          <Stat icon={Warning} label="Weak spots" value={(p.weak_concepts || []).length} color="#f87171" />
        </div>

        {/* mastery */}
        <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4"><Star size={18} className="text-green-400" weight="fill" /><h3 className="font-heading font-bold">Concept mastery</h3></div>
          <div className="space-y-3">
            {(p.strong_concepts || []).slice(0, 5).map((c, i) => <MasteryBar key={i} label={c} pct={90} color="#4ade80" />)}
            {(p.weak_concepts || []).slice(0, 5).map((c, i) => <MasteryBar key={`w${i}`} label={c} pct={35} color="#f87171" />)}
            {!(p.strong_concepts || []).length && !(p.weak_concepts || []).length && <Empty text="Your mastery map builds as you learn." />}
          </div>
        </div>

        {/* recent reports */}
        <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-6">
          <h3 className="font-heading font-bold mb-4">Recent reports</h3>
          {reports.length ? (
            <div className="space-y-2">
              {reports.slice(0, 6).map((r) => (
                <div key={r.report_id} className="flex items-center justify-between border border-border rounded-xl px-4 py-2.5">
                  <span className="text-sm truncate">{r.topic}</span>
                  <span className="font-mono font-bold text-primary">{r.score}%</span>
                </div>
              ))}
            </div>
          ) : <Empty text="No assessments yet." />}
        </div>

        {/* learning paths */}
        <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Path size={18} className="text-accent" weight="bold" /><h3 className="font-heading font-bold">Learning paths</h3></div>
            <button onClick={() => nav('/paths')} className="text-sm text-primary font-semibold" data-testid="view-paths">Manage →</button>
          </div>
          {paths.length ? paths.slice(0, 2).map((pa) => (
            <div key={pa.path_id} className="mb-3">
              <div className="text-sm font-semibold mb-2">{pa.topic}</div>
              <div className="flex flex-wrap gap-2">
                {pa.steps.map((s, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded-full border ${s.status === 'done' ? 'border-green-500/40 text-green-400' : s.status === 'current' ? 'border-primary text-primary' : 'border-border text-muted'}`}>{s.title}</span>
                ))}
              </div>
            </div>
          )) : <Empty text="Create a learning path for a broad topic like 'Machine Learning'." />}
        </div>

        <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2"><Bug size={18} className="text-muted" /><h3 className="font-heading font-bold">Provider status</h3></div>
            <p className="text-sm text-muted">See which LLM provider is serving requests and simulate a fallback.</p>
          </div>
          <button onClick={() => nav('/admin')} className="btn-ghost mt-4 text-sm" data-testid="open-admin">Open debug view</button>
        </div>
      </div>
    </Layout>
  );
}

function Stat({ icon: Icon, label, value, color = '#e3ff37' }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <Icon size={22} weight="duotone" style={{ color }} />
      <div className="font-mono text-3xl font-black mt-3">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted">{label}</div>
    </div>
  );
}
function MasteryBar({ label, pct, color }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1"><span className="truncate">{label}</span><span className="font-mono text-muted">{pct}%</span></div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}
function Empty({ text }) { return <p className="text-sm text-muted py-6 text-center">{text}</p>; }
