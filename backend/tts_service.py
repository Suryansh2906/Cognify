"""Layered TTS. Primary narration is the browser Web Speech API (frontend, free).
The backend provides higher-quality voices on demand:
  edge-tts (free, no key) and ElevenLabs (showcase only, quota-limited).
Per-segment provider is configurable; ElevenLabs auto-falls back to edge-tts on quota errors."""
import base64
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "").strip()

EDGE_VOICES = {"en": "en-US-AriaNeural", "hi": "hi-IN-SwaraNeural"}
ELEVEN_VOICE = "21m00Tcm4TlvDq8ikWAM"  # Rachel


async def edge_tts(text: str, lang: str = "en"):
    import edge_tts
    voice = EDGE_VOICES.get(lang, EDGE_VOICES["en"])
    communicate = edge_tts.Communicate(text, voice)
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
    return bytes(audio)


async def elevenlabs_tts(text: str):
    if not ELEVENLABS_API_KEY:
        raise RuntimeError("no_elevenlabs_key")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_VOICE}"
    headers = {"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"}
    body = {"text": text, "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=body)
        if r.status_code in (401, 429) or r.status_code >= 400:
            raise RuntimeError(f"elevenlabs_error_{r.status_code}")
        return r.content


async def synthesize(text: str, lang: str = "en", provider: str = "edge"):
    text = (text or "").strip()[:2500]
    if not text:
        return {"provider": "none", "audio_b64": "", "mime": "audio/mpeg"}
    used = provider
    try:
        if provider == "elevenlabs":
            try:
                audio = await elevenlabs_tts(text)
                used = "elevenlabs"
            except Exception:
                audio = await edge_tts(text, lang)
                used = "edge (elevenlabs fallback)"
        else:
            audio = await edge_tts(text, lang)
            used = "edge"
    except Exception as e:
        return {"provider": "failed", "audio_b64": "", "mime": "audio/mpeg", "error": str(e)}
    return {"provider": used, "audio_b64": base64.b64encode(audio).decode(), "mime": "audio/mpeg"}
