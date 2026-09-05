# Cognify

An AI educator that teaches — not just answers. Upload a document or name a topic, and Cognify plans a real lesson, explains it with an avatar, voice, and visuals, questions you along the way, catches misconceptions, and reports how you did at the end.

Built for the AI Innovation Hackathon 2026 (Bharat Academix).

## 🚀 Live Demo

**Live Application:**  
https://cognify-sand.vercel.app/

**Backend API:**  
https://cognify-nb0o.onrender.com

### ⏱️ Demo / Cold-Start Note

Cognify's backend is deployed on **Render's Free Tier**.

Render automatically spins down a Free web service after **15 minutes without inbound traffic**. When the next request arrives, the service has to spin back up, which can take **about one minute**.

> **For judging/demo:** If Cognify has been inactive for a while, the first interaction may take up to approximately one minute while the backend wakes up. Please allow the loading process to complete. Once the backend is active, subsequent requests operate normally.

This delay is a characteristic of the hosting tier and **is not an application or API failure**.

Cognify uses a split deployment:
- **Frontend:** Vercel
- **Backend API:** Render
- **Database:** MongoDB Atlas

## 🎯 Quick Look

- Learns from an uploaded PDF/DOCX/PPTX/text file, or from a topic alone
- Plans lessons that actually scale with time (5 min vs 60 min vs multi-day)
- Explains with subject-appropriate visuals (equations, diagrams, timelines, code)
- Narrates lessons with a synced avatar, voice, and captions
- Asks questions mid-lesson and re-teaches when you get something wrong
- Works in English and Hindi, including mid-lesson language switching
- Scores you at the end and remembers your progress for next time

## 🏗️ Architecture

Cognify uses a split frontend/backend architecture:

```text
User
 │
 ▼
┌─────────────────────────────┐
│          Vercel             │
│      React Frontend         │
└─────────────┬───────────────┘
              │ HTTPS / REST API
              ▼
┌─────────────────────────────┐
│          Render             │
│      FastAPI Backend        │
│                             │
│  LLM • RAG • TTS • Auth     │
│  Lessons • Sessions • Data  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│       MongoDB Atlas         │
│   Users • Sessions • Data   │
│      • Embeddings            │
└─────────────────────────────┘
```

The backend keeps API credentials server-side and handles LLM, RAG, authentication, lesson generation, and text-to-speech operations.

For the complete system design, AI/ML architecture, RAG pipeline, third-party services, configuration, and deployment details, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## 💻 Running it locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

### Frontend

```bash
cd frontend
yarn install
yarn start
```

You'll need the required API keys and environment variables first — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) for exactly which ones and where they go.

## 📚 Learn More

The full system design, AI/ML models and third-party services, RAG pipeline, deployment architecture, and assessment methodology are documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md).
