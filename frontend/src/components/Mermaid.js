import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'dark',
  themeVariables: {
    primaryColor: '#232329',
    primaryTextColor: '#fafafa',
    primaryBorderColor: '#e3ff37',
    lineColor: '#00e5ff',
    fontSize: '15px',
    fontFamily: 'JetBrains Mono, monospace',
  },
});

let seq = 0;

// Strip LLM-supplied styling so every diagram uses our readable dark theme.
function sanitize(code) {
  return (code || '')
    .split('\n')
    .filter((line) => {
      const t = line.trim().toLowerCase();
      return !(t.startsWith('style ') || t.startsWith('classdef') || t.startsWith('class ') || t.startsWith('linkstyle'));
    })
    .map((line) => line.replace(/:::[A-Za-z0-9_]+/g, ''))
    .join('\n');
}

function svgToUrl(svg) {
  try {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  } catch (e) {
    return '';
  }
}

export default function Mermaid({ code }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState(false);

  useEffect(() => {
    let active = true;
    if (!code) return;
    const id = `mmd-${Date.now()}-${seq++}`;
    mermaid.render(id, sanitize(code))
      .then((res) => { if (active) setUrl(svgToUrl(res.svg)); })
      .catch(() => { if (active) setErr(true); });
    return () => { active = false; };
  }, [code]);

  if (err) {
    return (
      <pre className="text-xs text-muted font-mono whitespace-pre-wrap bg-[#0d0d0f] border border-border rounded-xl p-3" data-testid="mermaid-diagram">
        {code}
      </pre>
    );
  }
  return (
    <div className="flex justify-center bg-[#0d0d0f] border border-border rounded-xl p-4" data-testid="mermaid-diagram">
      {url ? <img src={url} alt="diagram" className="max-w-full max-h-[300px] object-contain" /> : <div className="h-16" />}
    </div>
  );
}
