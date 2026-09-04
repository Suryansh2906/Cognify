"""Emergent-managed Google Auth. Session token stored in Mongo + httpOnly cookie.
REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH"""
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import Cookie, Header, HTTPException

from db import db

SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


async def exchange_session(session_id: str):
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(SESSION_DATA_URL, headers={"X-Session-ID": session_id})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        return r.json()


async def upsert_user(data: dict):
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id},
                                  {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": data.get("name"),
            "picture": data.get("picture"), "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.learner_profiles.insert_one({
            "user_id": user_id, "default_level": "beginner", "preferred_languages": ["en"],
            "preferred_style": "clear and friendly", "onboarded": False,
            "topics_studied": [], "strong_concepts": [], "weak_concepts": [],
            "score_history": [], "current_learning_path_id": None,
        })
    return user_id


async def create_session(user_id: str, session_token: str):
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def get_current_user(session_token: str = Cookie(default=None),
                           authorization: str = Header(default=None)):
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def create_guest_user():
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id, "email": None, "name": "Guest",
        "picture": None, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.learner_profiles.insert_one({
        "user_id": user_id, "default_level": "beginner", "preferred_languages": ["en"],
        "preferred_style": "clear and friendly", "onboarded": False,
        "topics_studied": [], "strong_concepts": [], "weak_concepts": [],
        "score_history": [], "current_learning_path_id": None,
    })
    return user_id
