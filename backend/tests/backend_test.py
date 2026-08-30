"""Regression tests for the AI Teacher endpoints that the frontend flows depend on.

Scope (frontend-support smoke): public demo lesson, auth via pre-seeded session,
materials listing, LLM provider status + graceful all-providers-fail 503.
"""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing from env and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")

TEST_TOKEN = "test_session_main"  # from /app/memory/test_credentials.md
ALL_PROVIDERS = ["gemini", "groq", "openrouter", "emergent"]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {TEST_TOKEN}"})
    return s


# ---------------- health / public ----------------
class TestPublic:
    def test_health(self, client):
        r = client.get(f"{BASE_URL}/api/health", timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_demo_lesson_is_static_and_complete(self, client):
        r = client.get(f"{BASE_URL}/api/demo/lesson", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "_id" not in d
        assert d["plan_id"] == "seed_newtons_laws"
        assert len(d["segments"]) == 4
        # every segment must carry a checkpoint + a visual spec so the player works with no LLM
        for seg in d["segments"]:
            assert seg["checkpoint"]["question"]
            assert seg["visual_spec"]
            assert seg["script"]

    def test_llm_status_shape(self, client):
        r = client.get(f"{BASE_URL}/api/admin/llm-status", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["configured"], list) and len(d["configured"]) >= 1
        assert {"name", "model", "simulated_fail"} <= set(d["configured"][0].keys())


# ---------------- auth (pre-seeded session) ----------------
class TestAuth:
    def test_me_with_bearer(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["user_id"] == "test-user-1"
        assert d["profile"]["onboarded"] is True
        assert "_id" not in d["user"]

    def test_me_without_token_is_401(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401

    def test_materials_listing_persisted(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/materials", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for m in items:
            assert "_id" not in m
            assert m["material_id"].startswith("mat_")


# ---------------- graceful LLM fallback ----------------
class TestLLMFallback:
    @pytest.fixture(autouse=True)
    def reset_simulation(self, client):
        yield
        r = client.post(f"{BASE_URL}/api/admin/simulate-failure",
                        json={"providers": []}, timeout=30)
        assert r.status_code == 200
        assert r.json()["simulated_fail"] == []

    def test_all_providers_fail_returns_503_not_crash(self, client, auth_client):
        r = client.post(f"{BASE_URL}/api/admin/simulate-failure",
                        json={"providers": ALL_PROVIDERS}, timeout=30)
        assert r.status_code == 200
        assert set(r.json()["simulated_fail"]) == set(ALL_PROVIDERS)

        parse = auth_client.post(f"{BASE_URL}/api/lessons/parse-request",
                                 json={"instruction": "teach me gravity in 5 min"}, timeout=90)
        assert parse.status_code == 503
        assert "unavailable" in parse.json()["detail"].lower()

        plan = auth_client.post(f"{BASE_URL}/api/lessons/plan",
                                json={"topic": "TEST_Gravity", "level": "beginner",
                                      "language": "en", "time_budget_min": 5, "days": 1}, timeout=90)
        assert plan.status_code == 503
        assert "unavailable" in plan.json()["detail"].lower()

    def test_demo_lesson_still_served_while_llm_down(self, client):
        client.post(f"{BASE_URL}/api/admin/simulate-failure",
                    json={"providers": ALL_PROVIDERS}, timeout=30)
        r = client.get(f"{BASE_URL}/api/demo/lesson", timeout=30)
        assert r.status_code == 200
        assert len(r.json()["segments"]) == 4
