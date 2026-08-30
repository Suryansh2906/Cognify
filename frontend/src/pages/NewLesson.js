import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { Sparkle, UploadSimple, FileText, MagicWand, Clock } from '@phosphor-icons/react';

const TIMES = [{ v: 5, l: '5 min' }, { v: 20, l: '20 min' }, { v: 60, l: '60 min' }, { v: -1, l: 'Multi-day' }];

export default function NewLesson() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [instruction, setInstruction] = useState('');
  const [parsing, setParsing] = useState(false);
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState(profile?.default_level || 'beginner');
  const [language, setLanguage] = useState((profile?.preferred_languages || ['en'])[0]);
  const [timeChoice, setTimeChoice] = useState(20);
  const [days, setDays] = useState(7);
  const [style, setStyle] = useState(profile?.preferred_style || 'clear and friendly');
  const [askQ, setAskQ] = useState(true);
  const [materials, setMaterials] = useState([]);
  const [materialId, setMaterialId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { api.get('/materials').then((r) => setMaterials(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (location.state?.topic) setTopic(location.state.topic); }, [location.state]);

  const parseNL = async () => {
    if (!instruction.trim()) return;
    setParsing(true);
    try {
      const r = await api.post('/lessons/parse-request', {
        instruction, default_level: level, default_language: language,
      });
      const c = r.data;
      if (c.topic) setTopic(c.topic);
      if (c.level) setLevel(c.level);
      if (c.language) setLanguage(c.language);
      if (c.days > 1) { setTimeChoice(-1); setDays(c.days); }
      else if (c.time_budget_min) setTimeChoice([5, 20, 60].includes(c.time_budget_min) ? c.time_budget_min : 20);
      if (c.style) setStyle(c.style);
      setAskQ(c.ask_questions_midlesson !== false);
      toast.success('Parsed your request — check the config below');
    } catch (e) {
      toast.error(e?.response?.status === 503 ? 'AI service busy, retry' : 'Could not parse');
    } finally { setParsing(false); }
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/materials/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMaterials((m) => [{ material_id: r.data.material_id, filename: r.data.filename, source_type: r.data.source_type, chapters: r.data.chapters }, ...m]);
      setMaterialId(r.data.material_id);
      toast.success(`Indexed ${r.data.chunks_indexed} chunks from ${r.data.filename}`);
    } catch (e) { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const generate = async () => {
    if (!topic.trim() && !materialId) { toast.error('Enter a topic or upload material'); return; }
    setGenerating(true);
    const isMulti = timeChoice === -1;
    try {
      const r = await api.post('/lessons/plan', {
        topic, material_id: materialId, level, language,
        time_budget_min: isMulti ? days * 30 : timeChoice,
        days: isMulti ? days : 1, style, ask_questions_midlesson: askQ, final_test: true,
      });
      if (r.data.kind === 'multiday') {
        toast.success('Multi-day plan created!');
        nav('/paths');
      } else {
        nav(`/player/${r.data.plan_id}`);
      }
    } catch (e) {
      toast.error(e?.response?.status === 503 ? 'AI service temporarily unavailable, please retry' : 'Generation failed');
    } finally { setGenerating(false); }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-heading font-black tracking-tight mb-2">New lesson</h1>
        <p className="text-muted mb-8">Describe what you want in a sentence, or configure it below.</p>

        {/* NL box */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-3">
            <MagicWand size={16} weight="fill" /> Tell me in plain language
          </div>
          <textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)}
            data-testid="nl-instruction-input"
            placeholder="e.g. I'm a beginner. Teach me Newton's Laws in 20 minutes in Hindi with simple examples. Ask me questions during the lesson." />
          <button onClick={parseNL} disabled={parsing} className="btn-ghost mt-3 flex items-center gap-2 text-sm" data-testid="parse-button">
            <Sparkle size={16} weight="fill" /> {parsing ? 'Parsing…' : 'Parse into config'}
          </button>
        </div>

        {/* upload */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent mb-3">
            <UploadSimple size={16} weight="bold" /> Teach from my material (PDF / DOCX / PPTX / TXT)
          </div>
          <label className="border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-600 transition-colors" data-testid="upload-dropzone">
            <FileText size={26} className="text-muted mb-2" />
            <span className="text-sm text-muted">{uploading ? 'Uploading & indexing…' : 'Click to upload a document'}</span>
            <input type="file" className="hidden" accept=".pdf,.docx,.pptx,.txt" data-testid="file-input"
              onChange={(e) => upload(e.target.files[0])} />
          </label>
          {materials.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {materials.map((m) => (
                <button key={m.material_id} onClick={() => setMaterialId(materialId === m.material_id ? null : m.material_id)}
                  data-testid={`material-${m.material_id}`}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${materialId === m.material_id ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  {m.filename} <span className="text-muted">· {m.source_type}</span>
                </button>
              ))}
            </div>
          )}
          {materialId && <p className="text-xs text-muted mt-2 font-mono">Grounded mode ON — lessons cite your document.</p>}
        </div>

        {/* config */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-5">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Topic / chapter</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-2" data-testid="topic-input"
              placeholder={materialId ? 'e.g. Chapter 4 (or leave blank for whole document)' : 'e.g. Newton\'s Laws of Motion'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-2" data-testid="level-select">
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-2" data-testid="language-select">
                <option value="en">English</option><option value="hi">हिंदी Hindi</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted flex items-center gap-1"><Clock size={13} /> Time budget</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {TIMES.map((t) => (
                <button key={t.v} onClick={() => setTimeChoice(t.v)} data-testid={`time-${t.v}`}
                  className={`py-2 rounded-xl border text-sm transition-colors ${timeChoice === t.v ? 'border-primary bg-primary/10' : 'border-border'}`}>{t.l}</button>
              ))}
            </div>
            {timeChoice === -1 && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm text-muted">Days:</span>
                <input type="number" min={2} max={30} value={days} onChange={(e) => setDays(+e.target.value)} className="!w-24" data-testid="days-input" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Ask me questions during the lesson</span>
            <button onClick={() => setAskQ(!askQ)} data-testid="ask-questions-toggle"
              className={`w-12 h-7 rounded-full transition-colors relative ${askQ ? 'bg-primary' : 'bg-secondary'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-background transition-transform ${askQ ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <button onClick={generate} disabled={generating} className="btn-primary w-full text-base" data-testid="generate-lesson-button">
          {generating ? 'Building your lesson…' : 'Generate lesson'}
        </button>
      </div>
    </Layout>
  );
}
