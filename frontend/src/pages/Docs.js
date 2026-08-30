import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowLeft } from '@phosphor-icons/react';

const Section = ({ title, children }) => (
  <section className="mb-10">
    <h2 className="text-2xl font-heading font-bold tracking-tight mb-3 text-primary">{title}</h2>
    <div className="text-foreground/85 leading-relaxed space-y-3">{children}</div>
  </section>
);

const Code = ({ children }) => <code className="font-mono text-sm bg-secondary px-1.5 py-0.5 rounded text-accent">{children}</code>;

export default function Docs() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center"><GraduationCap size={22} weight="fill" className="text-primary-foreground" /></div>
            <span className="font-heading font-black">AI Teacher · Docs</span>
          </div>
          <button onClick={() => nav(-1)} className="btn-ghost !py-2 !px-4 text-sm flex items-center gap-1" data-testid="docs-back"><ArrowLeft size={16} /> Back</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12" data-testid="docs-page">
        <h1 className="text-5xl font-heading font-black tracking-tighter mb-3">Documentation</h1>
        <p className="text-lg text-muted mb-12">How AI Teacher is built and how to run it.</p>

        <Section title="Problem statement">
          <p>Build a human-like AI educator that teaches any topic or uploaded material through an adaptive,
          interactive lesson — with an avatar and voice. It is explicitly not a Q&amp;A chatbot: it plans a lesson,
          explains it step by step with visuals, questions the learner mid-lesson, evaluates answers, detects
          misconceptions, adapts difficulty, and finishes with a scored assessment and a personalized report.</p>
        </Section>

        <Section title="Solution overview">
          <p>AI Teacher runs a real pedagogical state machine per concept:
          <strong> Understand → Plan → Explain → Demonstrate → Question → Evaluate → Adapt → Continue</strong>.
          A learner names a topic (or uploads a PDF/DOCX/PPTX/TXT), optionally in one plain-language sentence.
          The backend classifies the subject, builds a time-budgeted lesson plan, and renders it as a cinematic
          "video": an animated avatar narrates each slide (TTS) with subject-aware visuals and synced captions.
          At planned checkpoints it pauses to question the learner; wrong answers trigger a fresh re-explanation
          before moving on. A final quiz produces a scored report saved to the learner's profile.</p>
        </Section>

        <Section title="System architecture">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Frontend</strong>: React + Tailwind. Cinematic Lesson Player, Bento dashboard, KaTeX / Mermaid / Recharts / syntax-highlighter for visuals, framer-motion for the avatar and modals.</li>
            <li><strong>Backend</strong>: FastAPI. Owns every LLM call, the RAG pipeline, file parsing, and TTS. No API key ever reaches the browser.</li>
            <li><strong>Database</strong>: MongoDB stores relational data <em>and</em> vector embeddings in one place — no separate vector service. Similarity is computed in-process.</li>
          </ul>
        </Section>

        <Section title="AI / ML models & third-party APIs">
          <p><strong>LLM provider abstraction with automatic fallover</strong> (in <Code>llm_service.py</Code>):</p>
          <ol className="list-decimal pl-6 space-y-1">
            <li><strong>Google Gemini (Flash)</strong> — primary, key <Code>GEMINI_API_KEY</Code>.</li>
            <li><strong>Groq</strong> — first fallback, key <Code>GROQ_API_KEY</Code>.</li>
            <li><strong>OpenRouter</strong> (free-tier model) — second fallback, key <Code>OPENROUTER_API_KEY</Code>.</li>
            <li><strong>Emergent Universal Key</strong> — always-on final fallback so the app works out of the box.</li>
          </ol>
          <p>Every "LLM call" goes through one interface that tries provider 1, catches HTTP errors, timeouts and
          429 rate-limits, retries once, then moves to the next provider — logging which provider served each
          request. Structured JSON (lesson plans, quizzes, grading) is validated the same way regardless of
          provider. If all providers fail, the learner sees a clear "AI service temporarily unavailable" state.
          The active provider is visible in the <Code>/admin</Code> debug view.</p>
          <p><strong>Embeddings</strong>: local <Code>BAAI/bge-small-en-v1.5</Code> via fastembed (no key, no cost),
          with a deterministic hashing fallback so RAG never hard-fails.</p>
          <p><strong>Text-to-speech (layered, cost-first)</strong>: (1) browser Web Speech API for everyday narration;
          (2) edge-tts (free neural voices) when a browser voice is missing — e.g. Hindi; (3) ElevenLabs reserved
          for the seed demo's showcase segment only, with automatic fallback to edge-tts on quota errors. The
          provider is configurable per lesson segment.</p>
          <p><strong>Speech-to-text</strong>: browser Web Speech recognition for spoken answers.</p>
        </Section>

        <Section title="How the RAG pipeline works">
          <p>On upload, the document is parsed (pypdf / python-docx / python-pptx / text) into page/section
          segments, chapters are detected, and the text is chunked (~900 chars, 150 overlap). Each chunk is
          embedded and stored in Mongo tied to the material with its <Code>page_ref</Code>. When teaching from
          material, the relevant chunks are retrieved by cosine similarity <em>before</em> any explanation is
          generated, and the lesson cites the source page. If retrieval finds nothing relevant, the lesson says
          so rather than inventing content. Source and teaching languages can differ (e.g. English textbook,
          Hindi lesson) without breaking retrieval.</p>
        </Section>

        <Section title="Personalization approach">
          <p>Each learner has a persistent profile: level, languages, topics studied, strong and weak concepts,
          and a score history. Assessment reports update this profile. When a returning learner starts a new
          lesson, known weak concepts are injected into the lesson-plan prompt so they get reinforced. Broad
          goals become an ordered learning path the learner can resume.</p>
        </Section>

        <Section title="Assessment methodology">
          <p>Mid-lesson checkpoints mix MCQ, short-answer, problem-solving, "explain in your own words," and
          application questions. Each answer is graded correct / partial / incorrect; wrong answers get the
          specific misconception named and trigger a re-teach with a new analogy plus a follow-up question. The
          end-of-lesson quiz is auto-sized to what was actually taught and produces a percentage score with
          strong areas, weak areas, a concrete revision recommendation, and a suggested next topic.</p>
        </Section>

        <Section title="Multilingual (English + Hindi)">
          <p>Lessons generate fully in English or Hindi. The learner can switch language mid-lesson — remaining
          segments are re-translated (text + audio) while preserving lesson context. Hinglish requests are
          understood by the natural-language parser.</p>
        </Section>

        <Section title="Setup instructions">
          <p>Backend env keys (<Code>backend/.env</Code>): <Code>MONGO_URL</Code>, <Code>DB_NAME</Code>,
          <Code>EMERGENT_LLM_KEY</Code> (preloaded), and optionally <Code>GEMINI_API_KEY</Code>,
          <Code>GROQ_API_KEY</Code>, <Code>OPENROUTER_API_KEY</Code>, <Code>ELEVENLABS_API_KEY</Code>.
          Add your own Gemini / Groq keys to make them the primary chain — the app already runs on the Emergent
          key with zero setup. Frontend uses <Code>REACT_APP_BACKEND_URL</Code>. The single seed demo
          (Newton's Laws of Motion) is loaded automatically and works even with no keys and no network to the LLM.</p>
        </Section>
      </div>
    </div>
  );
}
