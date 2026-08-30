"""Provider-abstraction LLM layer with automatic fallover.

Order: Gemini (direct) -> Groq (direct) -> OpenRouter (direct) -> Emergent (always-on).
Each provider is tried with a single retry, then we move to the next. Every call is
logged with the provider that actually served it, surfaced via /api/admin/llm-status.
A SIMULATE_FAIL set lets an admin force a provider to fail to demo the fallback chain.
"""
import asyncio
import json
import os
import re
import time
import uuid
from collections import deque

import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "").strip()

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
EMERGENT_MODEL = os.environ.get("EMERGENT_MODEL", "gemini-3-flash-preview")

CALL_LOG = deque(maxlen=60)
LAST_PROVIDER = {"name": None, "model": None, "ts": None}
SIMULATE_FAIL = set()  # provider names forced to fail (admin toggle)


class LLMUnavailable(Exception):
    pass


def _log(provider, model, ok, detail=""):
    CALL_LOG.appendleft({
        "provider": provider, "model": model, "ok": ok,
        "detail": detail[:160], "ts": time.strftime("%H:%M:%S"),
    })


async def _openai_compat(base_url, key, model, system, prompt, json_mode, temperature, extra_headers=None):
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    body = {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        "temperature": temperature,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(base_url, headers=headers, json=body)
        if r.status_code == 429:
            raise RuntimeError("rate_limit")
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def _call_gemini(system, prompt, json_mode, temperature):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    gen = {"temperature": temperature}
    if json_mode:
        gen["responseMimeType"] = "application/json"
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": gen,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, json=body)
        if r.status_code == 429:
            raise RuntimeError("rate_limit")
        r.raise_for_status()
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def _call_groq(system, prompt, json_mode, temperature):
    return await _openai_compat(
        "https://api.groq.com/openai/v1/chat/completions",
        GROQ_API_KEY, GROQ_MODEL, system, prompt, json_mode, temperature)


async def _call_openrouter(system, prompt, json_mode, temperature):
    return await _openai_compat(
        "https://openrouter.ai/api/v1/chat/completions",
        OPENROUTER_API_KEY, OPENROUTER_MODEL, system, prompt, json_mode, temperature,
        extra_headers={"HTTP-Referer": "https://ai-teacher.app", "X-Title": "AI Teacher"})


async def _call_emergent(system, prompt, json_mode, temperature):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    sys_msg = system
    if json_mode:
        sys_msg = system + "\n\nYou MUST respond with a single valid JSON object and nothing else. No markdown, no code fences."
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"aiteacher-{uuid.uuid4().hex[:10]}",
                   system_message=sys_msg).with_model("gemini", EMERGENT_MODEL)
    res = await chat.send_message(UserMessage(text=prompt))
    if isinstance(res, str):
        return res
    return getattr(res, "content", None) or getattr(res, "text", None) or str(res)


def _providers():
    out = []
    if GEMINI_API_KEY:
        out.append(("gemini", GEMINI_MODEL, _call_gemini))
    if GROQ_API_KEY:
        out.append(("groq", GROQ_MODEL, _call_groq))
    if OPENROUTER_API_KEY:
        out.append(("openrouter", OPENROUTER_MODEL, _call_openrouter))
    if EMERGENT_LLM_KEY:
        out.append(("emergent", EMERGENT_MODEL, _call_emergent))
    return out


def provider_status():
    return {
        "configured": [{"name": n, "model": m, "simulated_fail": n in SIMULATE_FAIL} for n, m, _ in _providers()],
        "last_used": LAST_PROVIDER,
        "recent_calls": list(CALL_LOG)[:25],
    }


async def generate(prompt: str, system: str = "You are a helpful assistant.",
                   json_mode: bool = False, temperature: float = 0.6, timeout: float = 90):
    providers = _providers()
    if not providers:
        raise LLMUnavailable("No LLM providers configured")
    last_err = None
    for name, model, fn in providers:
        for attempt in range(2):  # initial + one retry
            try:
                if name in SIMULATE_FAIL:
                    raise RuntimeError("simulated_failure")
                text = await asyncio.wait_for(fn(system, prompt, json_mode, temperature), timeout=timeout)
                LAST_PROVIDER.update({"name": name, "model": model, "ts": time.strftime("%H:%M:%S")})
                _log(name, model, True, f"attempt {attempt + 1}")
                return text
            except Exception as e:  # noqa
                last_err = e
                _log(name, model, False, f"{type(e).__name__}: {e}")
                if name in SIMULATE_FAIL:
                    break  # don't retry a forced failure, move on
    raise LLMUnavailable(str(last_err))


def _extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    start = text.find("{")
    start_arr = text.find("[")
    if start_arr != -1 and (start == -1 or start_arr < start):
        start = start_arr
    depth, in_str, esc = 0, False, False
    open_ch = text[start] if start != -1 else "{"
    close_ch = "]" if open_ch == "[" else "}"
    for i in range(start, len(text)) if start != -1 else []:
        c = text[i]
        if esc:
            esc = False
            continue
        if c == "\\":
            esc = True
            continue
        if c == '"':
            in_str = not in_str
        elif not in_str:
            if c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    return json.loads(text[start:i + 1])
    raise ValueError("No JSON found in LLM output")


async def generate_json(prompt: str, system: str = "You are a helpful assistant.",
                        temperature: float = 0.5, timeout: float = 120):
    text = await generate(prompt, system, json_mode=True, temperature=temperature, timeout=timeout)
    try:
        return _extract_json(text)
    except Exception:
        fixed = await generate(
            "Convert the following into a single valid JSON object only, no prose:\n\n" + text,
            "You output only valid JSON.", json_mode=True, temperature=0, timeout=timeout)
        return _extract_json(fixed)
