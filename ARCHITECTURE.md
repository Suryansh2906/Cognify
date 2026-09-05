# Cognify — Architecture & Documentation

## Architecture

```text
frontend/   React + Tailwind — lesson player, avatar, checkpoints, dashboard, admin view
backend/    FastAPI — owns every LLM/TTS/RAG call so no key ever reaches the browser
  llm_service.py       provider-abstraction layer with automatic failover
  rag_service.py       chunk storage + in-process cosine-similarity retrieval
  embedding_service.py local, key-free embeddings (fastembed), with a hash fallback
  pedagogy.py          the Understand -> Plan -> Explain -> Demonstrate -> Question ->
                       Evaluate -> Adapt -> Continue engine
  parsing.py            PDF / DOCX / PPTX / text -> chunked, page-referenced text
  tts_service.py       layered text-to-speech
  auth.py, db.py, server.py, seed.py
```

Data lives in one MongoDB instance — both the relational data (users, profiles, sessions, reports) and the document embeddings, so there's no separate vector-database service to run.

## Authentication

Cognify uses lightweight guest sessions rather than a third-party login: on first visit, the app creates a profile in the background and remembers it in the browser via a locally-stored session token sent as a Bearer header on every request. No external identity provider, no redirect, no login screen to get in the way of trying the app — learner history and personalization still persist the same way a "real" login would provide, per-browser.

## AI / ML and third-party services

LLM (used for lesson planning, explanation, question generation, grading, misconception detection, and translation) — called through one internal provider-abstraction layer that automatically fails over in this order, retrying once per provider before moving on:

1. Google Gemini — primary
2. Groq — fallback

The active/last-used provider and full call history are visible at `/admin` for verification, and a provider can be manually forced to fail there to demonstrate the failover live.

Embeddings (for RAG): `fastembed` (BAAI/bge-small-en-v1.5), run locally — no external API or key required. Falls back to a deterministic hashing vector if the model can't load, so retrieval never hard-fails.

Text-to-speech, in priority order:

1. Browser Web Speech API — free, default, no key
2. `edge-tts` — free, no key, used automatically when the browser has no voice for the requested language (common for Hindi) or for a quality upgrade
3. ElevenLabs — used only for the seed demo lesson, given its free tier's 10,000-character/month cap; auto-falls back to `edge-tts` if the quota is hit

## RAG pipeline

Uploaded files are parsed by type (PDF via `pypdf`, DOCX via `python-docx`, PPTX via `python-pptx`, plain text directly), split into ~900-character overlapping chunks with a page/section reference kept on each chunk, embedded, and stored. At lesson-generation time, the relevant chunks are retrieved by cosine similarity; if nothing scores above the relevance threshold, the lesson plan is generated from general knowledge instead and marked accordingly rather than fabricating a citation.

## Setup

### Backend

Backend environment variables are configured through `backend/.env` locally and through the hosting provider's environment-variable dashboard in deployment. The `.env` file is never committed.

```text
GEMINI_API_KEY=
GROQ_API_KEY=
MONGO_URL=
DB_NAME=
```

### Frontend

```text
REACT_APP_BACKEND_URL=
```

## Deployment

Cognify uses a split deployment architecture:

```text
                    ┌─────────────────────────┐
                    │         Vercel          │
                    │     React Frontend      │
                    │       Free Tier         │
                    └────────────┬────────────┘
                                 │
                                 │ HTTPS / REST API
                                 ▼
                    ┌─────────────────────────┐
                    │         Render          │
                    │      FastAPI Backend    │
                    │        Free Tier        │
                    │                         │
                    │ LLM • RAG • TTS • Auth  │
                    │ Lessons • Sessions      │
                    └────────────┬────────────┘
                                 │
                                 │ MongoDB connection
                                 ▼
                    ┌─────────────────────────┐
                    │      MongoDB Atlas      │
                    │ Persistent Application  │
                    │          Data           │
                    └─────────────────────────┘
```

### Live Deployment

**Frontend:** Vercel  
**Backend API:** https://cognify-nb0o.onrender.com  
**Database:** MongoDB Atlas

The frontend communicates with the FastAPI backend through the `REACT_APP_BACKEND_URL` environment variable.

The backend keeps API credentials server-side and is responsible for all LLM, RAG, TTS, authentication, lesson-generation, and persistence operations.

### Render Free-Tier Cold Starts

The Cognify backend is deployed on a **Render Free Web Service**.

Render automatically spins down Free web services after **15 minutes without inbound traffic**. When a new request arrives after the service has been spun down, Render starts the service again. Render documents this spin-up as taking **about one minute**, and a loading page may be displayed while the service starts.

Therefore, during judging or a live demonstration:

> If the application has been inactive for a while, the first request may take up to approximately one minute while the backend wakes up. Once the service is active, subsequent requests operate normally.

This is a hosting-tier cold-start characteristic rather than an application or API failure.

### Deployment Configuration

The Render backend is configured as follows:

```text
Service Type: Web Service
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn server:app --host 0.0.0.0 --port $PORT
```

The frontend is deployed separately on Vercel and uses:

```text
REACT_APP_BACKEND_URL=https://cognify-nb0o.onrender.com
```

Secrets and API keys are configured through the deployment platforms' environment-variable dashboards and are not committed to the repository.

## Assessment methodology

At the end of a lesson, questions are generated covering only what was actually taught (mix of MCQ and short-answer). Grading returns a percentage score, which concepts were strong vs. weak, a specific recommended revision action, and a suggested next topic — all saved to the learner's profile so a returning learner's next lesson can reference their known weak areas.

## Scope notes

- Two languages (English, Hindi) are supported end-to-end deliberately, rather than a larger set supported shallowly.
- One seed demo subject (Newton's Laws of Motion) is preloaded as a guaranteed-working fallback; live topic/document input is the primary way the app is meant to be judged.
- Identity is per-browser (guest session), not cross-device — a deliberate trade-off to keep the app frictionless to try during judging.
- The backend is hosted on Render's Free Tier, so an initial cold start may occur after a period of inactivity.
