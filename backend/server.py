import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Form, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import llm_service
import rag_service
import tts_service
import pedagogy
import parsing
import auth
from db import db
from seed import ensure_seed, SEED_PLAN_ID

app = FastAPI(title="AI Teacher API")
api = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------------- Models ----------------
class SessionExchange(BaseModel):
    session_id: str


class Onboarding(BaseModel):
    default_level: str = "beginner"
    preferred_languages: list = ["en"]
    preferred_style: str = "clear and friendly"
    goals: str = ""


class ParseReq(BaseModel):
    instruction: str
    default_level: str = "beginner"
    default_language: str = "en"


class PlanReq(BaseModel):
    topic: str = ""
    material_id: str | None = None
    level: str = "beginner"
    language: str = "en"
    time_budget_min: int = 20
    days: int = 1
    style: str = "clear and friendly"
    ask_questions_midlesson: bool = True
    final_test: bool = True


class EvalReq(BaseModel):
    segment_index: int
    question: str
    answer: str
    concept: str = ""
    correct: str = ""


class ReportReq(BaseModel):
    answers: dict


class TTSReq(BaseModel):
    text: str
    lang: str = "en"
    provider: str = "edge"


class TranslateReq(BaseModel):
    language: str
    from_index: int = 0


class PathReq(BaseModel):
    topic: str
    level: str = "beginner"
    language: str = "en"


class SimReq(BaseModel):
    providers: list = []
    fail: bool | None = None


# ---------------- Auth ----------------
@api.post("/auth/session")
async def auth_session(body: SessionExchange, response: Response):
    data = await auth.exchange_session(body.session_id)
    user_id = await auth.upsert_user(data)
    token = data.get("session_token") or f"tok_{uuid.uuid4().hex}"
    await auth.create_session(user_id, token)
    response.set_cookie("session_token", token, httponly=True, secure=True,
                        samesite="none", path="/", max_age=7 * 24 * 3600)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    profile = await db.learner_profiles.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "profile": profile, "session_token": token}


@api.get("/auth/me")
async def auth_me(user=Depends(auth.get_current_user)):
    profile = await db.learner_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": user, "profile": profile}


@api.post("/auth/logout")
async def logout(response: Response, request: Request):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------------- Profile ----------------
@api.post("/profile/onboarding")
async def onboarding(body: Onboarding, user=Depends(auth.get_current_user)):
    await db.learner_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"default_level": body.default_level, "preferred_languages": body.preferred_languages,
                  "preferred_style": body.preferred_style, "goals": body.goals, "onboarded": True}})
    return await db.learner_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})


@api.get("/profile")
async def get_profile(user=Depends(auth.get_current_user)):
    profile = await db.learner_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    reports = await db.assessment_reports.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    lessons = await db.lesson_plans.find({"user_id": user["user_id"]}, {"_id": 0, "segments": 0}).sort("created_at", -1).to_list(50)
    paths = await db.learning_paths.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"profile": profile, "reports": reports, "lessons": lessons, "learning_paths": paths}


# ---------------- Materials / RAG ----------------
@api.post("/materials/upload")
async def upload_material(file: UploadFile = File(...), user=Depends(auth.get_current_user)):
    data = await file.read()
    parsed = parsing.parse_file(file.filename, data)
    material_id = f"mat_{uuid.uuid4().hex[:12]}"
    await db.course_materials.insert_one({
        "material_id": material_id, "user_id": user["user_id"], "filename": file.filename,
        "source_type": parsed["source_type"], "language": "auto", "raw_text": parsed["raw_text"],
        "chapters": parsed["chapters"], "created_at": now_iso(),
    })
    chunks = parsing.chunk_pages(parsed["pages"])
    n = await rag_service.index_material(material_id, chunks)
    return {"material_id": material_id, "filename": file.filename, "source_type": parsed["source_type"],
            "chapters": parsed["chapters"], "chunks_indexed": n}


@api.get("/materials")
async def list_materials(user=Depends(auth.get_current_user)):
    return await db.course_materials.find(
        {"user_id": user["user_id"]}, {"_id": 0, "raw_text": 0}).sort("created_at", -1).to_list(50)


# ---------------- Lesson planning ----------------
@api.post("/lessons/parse-request")
async def parse_request(body: ParseReq, user=Depends(auth.get_current_user)):
    try:
        cfg = await pedagogy.parse_request(
            body.instruction, {"level": body.default_level, "language": body.default_language})
        return cfg
    except llm_service.LLMUnavailable:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable, please retry")


@api.post("/lessons/plan")
async def make_plan(body: PlanReq, user=Depends(auth.get_current_user)):
    profile = await db.learner_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    weak = profile.get("weak_concepts", [])[:5]
    cfg = body.model_dump()
    try:
        if body.days and body.days > 1:
            plan = await pedagogy.generate_multiday_plan(cfg)
            plan_id = f"plan_{uuid.uuid4().hex[:12]}"
            doc = {"plan_id": plan_id, "user_id": user["user_id"], "topic": body.topic,
                   "kind": "multiday", "language": body.language, "level": body.level,
                   "time_budget_min": body.time_budget_min, "days": body.days,
                   "multiday": plan, "segments": [], "created_at": now_iso()}
            await db.lesson_plans.insert_one(doc)
            path_id = f"path_{uuid.uuid4().hex[:12]}"
            steps = [{"title": f"Day {d['day']}: {d['title']}", "detail": ", ".join(d.get("topics", [])),
                      "status": "pending"} for d in plan.get("days", [])]
            await db.learning_paths.insert_one({"path_id": path_id, "user_id": user["user_id"],
                                                "topic": body.topic, "steps": steps, "created_at": now_iso()})
            return {"plan_id": plan_id, "kind": "multiday", "multiday": plan, "learning_path_id": path_id}

        context, refs, grounded = "", [], False
        if body.material_id:
            context, refs, grounded = await rag_service.context_for(
                body.material_id, body.topic or "main concepts of this material", k=6)
        plan = await pedagogy.generate_lesson_plan(cfg, context=context, grounded=grounded, weak_concepts=weak)
        plan_id = f"plan_{uuid.uuid4().hex[:12]}"
        doc = {"plan_id": plan_id, "user_id": user["user_id"], "topic": plan.get("topic", body.topic),
               "kind": "lesson", "source_material_id": body.material_id, "level": body.level,
               "language": body.language, "time_budget_min": body.time_budget_min,
               "source_refs": refs, "created_at": now_iso(), **plan}
        await db.lesson_plans.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except llm_service.LLMUnavailable:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable, please retry")


@api.get("/lessons/{plan_id}")
async def get_lesson(plan_id: str):
    plan = await db.lesson_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return plan


@api.post("/lessons/{plan_id}/translate")
async def translate_lesson(plan_id: str, body: TranslateReq, user=Depends(auth.get_current_user)):
    plan = await db.lesson_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Lesson not found")
    segments = plan.get("segments", [])
    to_translate = segments[body.from_index:]
    lang_name = pedagogy.LANG_NAME.get(body.language, "English")
    payload = [{"i": body.from_index + i, "script": s.get("script", ""),
                "on_screen_text": s.get("on_screen_text", []),
                "checkpoint_question": (s.get("checkpoint") or {}).get("question", "")}
               for i, s in enumerate(to_translate)]
    import json as _json
    try:
        out = await llm_service.generate_json(
            f"Translate the 'script', each 'on_screen_text' item, and 'checkpoint_question' into {lang_name}. "
            f"Keep technical terms/equations intact. Return JSON: {{\"items\":[{{\"i\":int,\"script\":\"\",\"on_screen_text\":[],\"checkpoint_question\":\"\"}}]}}\n\n"
            + _json.dumps(payload, ensure_ascii=False)[:8000],
            "You are a precise translator. Output JSON only.", temperature=0.2)
    except llm_service.LLMUnavailable:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable, please retry")
    for item in out.get("items", []):
        idx = item.get("i")
        if idx is None or idx >= len(segments):
            continue
        segments[idx]["script"] = item.get("script", segments[idx].get("script"))
        if item.get("on_screen_text"):
            segments[idx]["on_screen_text"] = item["on_screen_text"]
        if segments[idx].get("checkpoint") and item.get("checkpoint_question"):
            segments[idx]["checkpoint"]["question"] = item["checkpoint_question"]
    await db.lesson_plans.update_one({"plan_id": plan_id}, {"$set": {"segments": segments, "language": body.language}})
    return {"segments": segments, "language": body.language}


# ---------------- Sessions / pedagogy loop ----------------
@api.post("/sessions/start")
async def start_session(body: dict, user=Depends(auth.get_current_user)):
    plan_id = body.get("plan_id")
    plan = await db.lesson_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Lesson not found")
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    await db.lesson_sessions.insert_one({
        "session_id": session_id, "plan_id": plan_id, "user_id": user["user_id"],
        "current_segment_index": 0, "status": "in_progress", "transcript": [],
        "checkpoint_responses": [], "created_at": now_iso()})
    return {"session_id": session_id, "plan_id": plan_id}


@api.post("/sessions/{session_id}/evaluate")
async def evaluate(session_id: str, body: EvalReq, user=Depends(auth.get_current_user)):
    sess = await db.lesson_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    plan = await db.lesson_plans.find_one({"plan_id": sess["plan_id"]}, {"_id": 0})
    lang = plan.get("language", "en")
    try:
        result = await pedagogy.evaluate_answer(body.question, body.answer, body.concept, body.correct, lang)
        adaptation = None
        if result.get("verdict") in ("incorrect", "partial"):
            adaptation = await pedagogy.adapt_reteach(
                body.concept, result.get("misconception", ""), plan.get("level", "beginner"), lang)
    except llm_service.LLMUnavailable:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable, please retry")
    cr = {"response_id": f"cr_{uuid.uuid4().hex[:10]}", "session_id": session_id,
          "question": body.question, "student_answer": body.answer, "concept": body.concept,
          "evaluation": result, "misconception_note": result.get("misconception", ""), "ts": now_iso()}
    await db.lesson_sessions.update_one({"session_id": session_id},
                                        {"$push": {"checkpoint_responses": cr}})
    await db.checkpoint_responses.insert_one(dict(cr))
    return {"evaluation": result, "adaptation": adaptation}


@api.get("/sessions/{session_id}")
async def get_session(session_id: str, user=Depends(auth.get_current_user)):
    sess = await db.lesson_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess


@api.post("/sessions/{session_id}/assessment")
async def make_assessment(session_id: str, user=Depends(auth.get_current_user)):
    sess = await db.lesson_sessions.find_one({"session_id": session_id}, {"_id": 0})
    plan = await db.lesson_plans.find_one({"plan_id": sess["plan_id"]}, {"_id": 0})
    if plan.get("plan_id") == SEED_PLAN_ID:
        seed_a = await db.seed_assessments.find_one({"plan_id": SEED_PLAN_ID}, {"_id": 0})
        return {"questions": seed_a["questions"]}
    try:
        data = await pedagogy.generate_assessment(plan, plan.get("language", "en"))
    except llm_service.LLMUnavailable:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable, please retry")
    await db.lesson_sessions.update_one({"session_id": session_id},
                                        {"$set": {"assessment_questions": data.get("questions", [])}})
    return data


@api.post("/sessions/{session_id}/report")
async def make_report(session_id: str, body: ReportReq, user=Depends(auth.get_current_user)):
    sess = await db.lesson_sessions.find_one({"session_id": session_id}, {"_id": 0})
    plan = await db.lesson_plans.find_one({"plan_id": sess["plan_id"]}, {"_id": 0})
    questions = sess.get("assessment_questions")
    if not questions and plan.get("plan_id") == SEED_PLAN_ID:
        seed_a = await db.seed_assessments.find_one({"plan_id": SEED_PLAN_ID}, {"_id": 0})
        questions = seed_a["questions"]
    try:
        report = await pedagogy.grade_assessment(plan, questions or [], body.answers, plan.get("language", "en"))
    except llm_service.LLMUnavailable:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable, please retry")
    report_id = f"rep_{uuid.uuid4().hex[:12]}"
    doc = {"report_id": report_id, "session_id": session_id, "user_id": user["user_id"],
           "topic": plan.get("topic"), "created_at": now_iso(), **report}
    await db.assessment_reports.insert_one(dict(doc))
    await db.lesson_sessions.update_one({"session_id": session_id}, {"$set": {"status": "completed"}})
    # Update learner profile (personalization)
    prof = await db.learner_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    topics = set(prof.get("topics_studied", []))
    topics.add(plan.get("topic"))
    strong = set(prof.get("strong_concepts", [])) | set(report.get("strong_areas", []))
    weak = set(prof.get("weak_concepts", [])) | set(report.get("weak_areas", []))
    strong -= set(report.get("weak_areas", []))
    weak -= set(report.get("strong_areas", []))
    history = prof.get("score_history", [])
    history.append({"topic": plan.get("topic"), "score": report.get("score", 0), "date": now_iso()})
    await db.learner_profiles.update_one({"user_id": user["user_id"]}, {"$set": {
        "topics_studied": list(topics), "strong_concepts": list(strong)[:40],
        "weak_concepts": list(weak)[:40], "score_history": history}})
    doc.pop("_id", None)
    return doc


# ---------------- Learning paths ----------------
@api.post("/learning-paths")
async def create_path(body: PathReq, user=Depends(auth.get_current_user)):
    try:
        data = await pedagogy.generate_learning_path(body.topic, body.level, body.language)
    except llm_service.LLMUnavailable:
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable, please retry")
    path_id = f"path_{uuid.uuid4().hex[:12]}"
    steps = [{"title": s.get("title"), "detail": s.get("detail", ""), "status": "pending"}
             for s in data.get("steps", [])]
    if steps:
        steps[0]["status"] = "current"
    doc = {"path_id": path_id, "user_id": user["user_id"], "topic": body.topic,
           "steps": steps, "created_at": now_iso()}
    await db.learning_paths.insert_one(dict(doc))
    await db.learner_profiles.update_one({"user_id": user["user_id"]},
                                         {"$set": {"current_learning_path_id": path_id}})
    doc.pop("_id", None)
    return doc


@api.post("/learning-paths/{path_id}/advance")
async def advance_path(path_id: str, user=Depends(auth.get_current_user)):
    path = await db.learning_paths.find_one({"path_id": path_id}, {"_id": 0})
    if not path:
        raise HTTPException(status_code=404, detail="Path not found")
    steps = path["steps"]
    for i, s in enumerate(steps):
        if s["status"] in ("current", "pending"):
            s["status"] = "done"
            if i + 1 < len(steps):
                steps[i + 1]["status"] = "current"
            break
    await db.learning_paths.update_one({"path_id": path_id}, {"$set": {"steps": steps}})
    return {"steps": steps}


# ---------------- TTS ----------------
@api.post("/tts")
async def tts(body: TTSReq):
    return await tts_service.synthesize(body.text, body.lang, body.provider)


# ---------------- Demo (public) ----------------
@api.get("/demo/lesson")
async def demo_lesson():
    plan = await db.lesson_plans.find_one({"plan_id": SEED_PLAN_ID}, {"_id": 0})
    if not plan:
        await ensure_seed(db)
        plan = await db.lesson_plans.find_one({"plan_id": SEED_PLAN_ID}, {"_id": 0})
    return plan


# ---------------- Admin / debug ----------------
@api.get("/admin/llm-status")
async def llm_status():
    return llm_service.provider_status()


@api.post("/admin/simulate-failure")
async def simulate_failure(body: SimReq):
    if body.fail is None:
        # replace semantics: the given list is the exact set of failing providers
        llm_service.SIMULATE_FAIL.clear()
        for p in body.providers:
            llm_service.SIMULATE_FAIL.add(p)
    else:
        for p in body.providers:
            if body.fail:
                llm_service.SIMULATE_FAIL.add(p)
            else:
                llm_service.SIMULATE_FAIL.discard(p)
    return {"simulated_fail": list(llm_service.SIMULATE_FAIL)}


@api.get("/health")
async def health():
    return {"status": "ok", "providers": [p["name"] for p in llm_service.provider_status()["configured"]]}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await ensure_seed(db)
