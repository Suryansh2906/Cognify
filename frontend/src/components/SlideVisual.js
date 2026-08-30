import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Mermaid from './Mermaid';
import Katex from './Katex';

const LABEL = 'text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-3';

function KeyPoints({ points = [] }) {
  return (
    <ul className="space-y-3" data-testid="visual-keypoints">
      {points.map((p, i) => (
        <li key={i} className="flex gap-3 items-start">
          <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0 glow-primary" />
          <span className="text-lg leading-relaxed">{p}</span>
        </li>
      ))}
    </ul>
  );
}

function Graph({ graph }) {
  if (!graph || !graph.series || !graph.series.length) return null;
  const series = graph.series;
  const data = (series[0].data || []).map((d, i) => {
    const row = { x: d.x !== undefined ? d.x : i };
    series.forEach((s) => { const pt = (s.data || [])[i]; if (pt) row[s.name] = pt.y; });
    return row;
  });
  const colors = ['#e3ff37', '#00e5ff', '#f97316'];
  return (
    <div data-testid="visual-graph">
      {graph.title && <div className={LABEL}>{graph.title}</div>}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -10 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="x" stroke="#a1a1aa" fontSize={12} />
          <YAxis stroke="#a1a1aa" fontSize={12} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
          <Legend />
          {series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={colors[i % colors.length]} strokeWidth={2.5} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Timeline({ items = [], markers = [] }) {
  return (
    <div data-testid="visual-timeline">
      <div className="relative border-l-2 border-accent/40 ml-3 space-y-6 py-2">
        {items.map((it, i) => (
          <div key={i} className="pl-6 relative">
            <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-accent glow-accent" />
            <div className="font-mono text-primary text-sm">{it.year}</div>
            <div className="text-lg">{it.event}</div>
          </div>
        ))}
      </div>
      {markers && markers.length > 0 && (
        <div className="mt-5">
          <div className={LABEL}>Locations</div>
          <div className="flex flex-wrap gap-2">
            {markers.map((m, i) => (
              <span key={i} className="glass rounded-full px-3 py-1 text-sm">{m.place}{m.note ? ` — ${m.note}` : ''}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code, language, output }) {
  return (
    <div data-testid="visual-code" className="space-y-3">
      <SyntaxHighlighter language={language || 'python'} style={vscDarkPlus}
        customStyle={{ borderRadius: 12, border: '1px solid #27272a', fontSize: 13, margin: 0, background: '#0d0d0f' }}>
        {code || ''}
      </SyntaxHighlighter>
      {output && (
        <div>
          <div className={LABEL}>Output</div>
          <pre className="bg-black/60 border border-border rounded-xl p-3 text-sm text-accent font-mono whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
}

function Formulas({ formulas = [], steps = [], equations = [] }) {
  const eqs = [...(equations || []), ...(formulas || [])];
  return (
    <div className="space-y-4">
      {eqs.length > 0 && (
        <div className="flex flex-wrap gap-3" data-testid="visual-formulas">
          {eqs.map((f, i) => (
            <div key={i} className="glass rounded-xl px-4 py-3"><Katex tex={f} display /></div>
          ))}
        </div>
      )}
      {steps && steps.length > 0 && (
        <div>
          <div className={LABEL}>Worked steps</div>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-primary">{i + 1}.</span>
                <span className="font-mono text-sm"><Katex tex={s} /></span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function SlideVisual({ segment }) {
  if (!segment) return null;
  const t = segment.visual_type;
  const v = segment.visual_spec || {};
  return (
    <div className="space-y-6" data-testid="slide-visual">
      {(t === 'physics' || t === 'chemistry' || t === 'biology') && (
        <>
          {v.diagram_mermaid && <Mermaid code={v.diagram_mermaid} />}
          <Formulas formulas={v.formulas} steps={v.steps} equations={v.equations} />
          {v.points && <KeyPoints points={v.points} />}
        </>
      )}
      {t === 'math' && (
        <>
          <Formulas equations={v.equations} formulas={v.formulas} steps={v.steps} />
          {v.graph && <Graph graph={v.graph} />}
          {v.points && <KeyPoints points={v.points} />}
        </>
      )}
      {t === 'programming' && (
        <>
          <CodeBlock code={v.code} language={v.code_language} output={v.code_output} />
          {v.diagram_mermaid && <Mermaid code={v.diagram_mermaid} />}
          {v.points && <KeyPoints points={v.points} />}
        </>
      )}
      {(t === 'history' || t === 'geography') && (
        <>
          <Timeline items={v.timeline || []} markers={v.map_markers || []} />
          {v.points && <KeyPoints points={v.points} />}
        </>
      )}
      {t === 'economics' && (
        <>
          {v.graph && <Graph graph={v.graph} />}
          {v.points && <KeyPoints points={v.points} />}
        </>
      )}
      {(!['physics', 'chemistry', 'biology', 'math', 'programming', 'history', 'geography', 'economics'].includes(t)) && (
        <>
          {v.points && <KeyPoints points={v.points} />}
          {v.equations && v.equations.length > 0 && <Formulas equations={v.equations} />}
        </>
      )}
    </div>
  );
}
