"""Local, key-free embeddings via fastembed (BAAI/bge-small-en-v1.5).
Falls back to a deterministic hashing bag-of-words vector if the model
cannot load, so RAG never hard-fails."""
import hashlib
import math
import re

_model = None
_DIM = 384


def _load():
    global _model
    if _model is None:
        from fastembed import TextEmbedding
        _model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _model


def _hash_embed(text: str):
    vec = [0.0] * _DIM
    tokens = re.findall(r"\w+", text.lower())
    for tok in tokens:
        h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
        vec[h % _DIM] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def embed(texts):
    if isinstance(texts, str):
        texts = [texts]
    try:
        model = _load()
        return [list(map(float, v)) for v in model.embed(texts)]
    except Exception:
        return [_hash_embed(t) for t in texts]


def embed_one(text: str):
    return embed([text])[0]
