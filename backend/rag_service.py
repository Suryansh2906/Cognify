"""RAG: chunk storage, embedding, and cosine-similarity retrieval in Mongo.
Keeps infra minimal — vectors live in the same DB and similarity is computed
in-process, no separate vector service."""
import math
import uuid

import embedding_service
from db import db


async def index_material(material_id: str, chunks):
    docs = []
    texts = [c["chunk_text"] for c in chunks]
    vectors = embedding_service.embed(texts) if texts else []
    for c, vec in zip(chunks, vectors):
        docs.append({
            "chunk_id": f"chunk_{uuid.uuid4().hex[:12]}",
            "material_id": material_id,
            "chunk_text": c["chunk_text"],
            "page_ref": c["page_ref"],
            "embedding": vec,
        })
    if docs:
        await db.document_chunks.insert_many(docs)
    return len(docs)


def _cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


async def retrieve(material_id: str, query: str, k: int = 5, min_score: float = 0.25):
    qv = embedding_service.embed_one(query)
    cursor = db.document_chunks.find({"material_id": material_id}, {"_id": 0})
    scored = []
    async for doc in cursor:
        score = _cosine(qv, doc["embedding"])
        scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = [{"chunk_text": d["chunk_text"], "page_ref": d["page_ref"], "score": round(s, 3)}
           for s, d in scored[:k]]
    relevant = [t for t in top if t["score"] >= min_score]
    return relevant if relevant else top[:2], bool(relevant)


async def context_for(material_id: str, query: str, k: int = 5):
    chunks, relevant = await retrieve(material_id, query, k)
    if not chunks:
        return "", [], False
    ctx = "\n\n".join(f"[{c['page_ref']}] {c['chunk_text']}" for c in chunks)
    refs = [{"page_ref": c["page_ref"], "score": c["score"]} for c in chunks]
    return ctx, refs, relevant
