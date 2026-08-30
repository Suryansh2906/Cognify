import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import { CheckCircle, XCircle, Lightning, ArrowsClockwise } from '@phosphor-icons/react';

const PROVIDERS = ['gemini', 'groq', 'openrouter', 'emergent'];

export default function AdminDebug() {
  const [status, setStatus] = useState(null);
  const [failing, setFailing] = useState([]);

  const load = useCallback(() => api.get('/admin/llm-status').then((r) => {
    setStatus(r.data);
    setFailing(r.data.configured.filter((c) => c.simulated_fail).map((c) => c.name));
  }).catch(() => {}), []);

  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);

  const toggle = async (name) => {
    const next = failing.includes(name) ? failing.filter((n) => n !== name) : [...failing, name];
    setFailing(next);
    await api.post('/admin/simulate-failure', { providers: next });
    load();
  };

  const testCall = async () => {
    try { await api.post('/lessons/parse-request', { instruction: 'ping fallback test: teach me addition' }); }
    catch (e) { /* ignore */ }
    load();
  };

  return (
    <Layout>
      <h1 className="text-4xl font-heading font-black tracking-tight mb-2">LLM provider debug</h1>
      <p className="text-muted mb-8">Admin-only view. Force a provider to fail and watch the chain fall over — end users never see this.</p>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-6">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-2">Active provider</div>
          <div className="font-heading font-black text-3xl text-primary" data-testid="active-provider">{status?.last_used?.name || '—'}</div>
          <div className="font-mono text-sm text-muted mt-1">{status?.last_used?.model}</div>
          <div className="font-mono text-xs text-muted mt-1">last @ {status?.last_used?.ts || '—'}</div>
          <button onClick={testCall} className="btn-primary w-full mt-6 flex items-center justify-center gap-2 text-sm" data-testid="test-call-button">
            <Lightning size={16} weight="fill" /> Fire a test call
          </button>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-4">Fallback chain (toggle to simulate failure)</div>
          <div className="space-y-2">
            {PROVIDERS.map((name, i) => {
              const conf = status?.configured?.find((c) => c.name === name);
              const isFailing = failing.includes(name);
              return (
                <div key={name} className="flex items-center gap-3 border border-border rounded-xl px-4 py-3" data-testid={`provider-row-${name}`}>
                  <span className="font-mono text-muted text-sm w-5">{i + 1}</span>
                  <div className="flex-1">
                    <div className="font-semibold capitalize">{name} {conf ? '' : <span className="text-xs text-muted">(no key)</span>}</div>
                    <div className="font-mono text-xs text-muted">{conf?.model || 'not configured'}</div>
                  </div>
                  <button onClick={() => conf && toggle(name)} data-testid={`toggle-fail-${name}`} disabled={!conf}
                    className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1 ${!conf ? 'border-border text-muted opacity-60 cursor-not-allowed' : isFailing ? 'border-red-500/50 text-red-400' : 'border-border text-muted'}`}>
                    {!conf ? 'not configured' : isFailing ? <><XCircle size={14} weight="fill" /> forced fail</> : <><CheckCircle size={14} /> healthy</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 mt-5">
        <div className="flex items-center gap-2 mb-4"><ArrowsClockwise size={16} className="text-accent" /><div className="text-[11px] uppercase tracking-[0.2em] text-muted">Recent calls (newest first)</div></div>
        <div className="space-y-1 max-h-80 overflow-y-auto" data-testid="call-log">
          {(status?.recent_calls || []).map((c, i) => (
            <div key={i} className="flex items-center gap-3 font-mono text-xs border-b border-border/50 py-1.5">
              {c.ok ? <CheckCircle size={14} weight="fill" className="text-green-400" /> : <XCircle size={14} weight="fill" className="text-red-400" />}
              <span className="w-16 text-muted">{c.ts}</span>
              <span className="w-24 capitalize">{c.provider}</span>
              <span className="text-muted truncate flex-1">{c.detail}</span>
            </div>
          ))}
          {!(status?.recent_calls || []).length && <p className="text-sm text-muted py-4">No calls yet. Fire a test call.</p>}
        </div>
      </div>
    </Layout>
  );
}
