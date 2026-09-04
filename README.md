# Cognify

An AI educator that teaches — not just answers. Upload a document or name a topic, and
Cognify plans a real lesson, explains it with an avatar, voice, and visuals, questions
you along the way, catches misconceptions, and reports how you did at the end.

Built for the AI Innovation Hackathon 2026 (Bharat Academix).

## Quick look

- Learns from an uploaded PDF/DOCX/PPTX/text file, or from a topic alone
- Plans lessons that actually scale with time (5 min vs 60 min vs multi-day)
- Explains with subject-appropriate visuals (equations, diagrams, timelines, code)
- Narrates lessons with a synced avatar, voice, and captions
- Asks questions mid-lesson and re-teaches when you get something wrong
- Works in English and Hindi, including mid-lesson language switching
- Scores you at the end and remembers your progress for next time

## Running it locally

```
cd backend && pip install -r requirements.txt && uvicorn server:app --reload
cd frontend && yarn install && yarn start
```

You'll need a few free API keys first — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) for
exactly which ones and where they go.

## Learn more

Full system design, the AI/ML models and third-party services used, the RAG pipeline,
and deployment details are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).
