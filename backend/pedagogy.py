"""The pedagogical engine. Implements the loop:
Understand -> Plan -> Explain -> Demonstrate -> Question -> Evaluate -> Adapt -> Continue.
All LLM calls go through llm_service (provider-agnostic, JSON-validated)."""
import json

import llm_service

SUBJECTS = ["math", "physics", "chemistry", "biology", "history", "geography",
            "programming", "economics", "language", "general"]

VISUAL_RULES = {
    "math": "step-by-step worked equations (KaTeX) plus a graph where a function/relationship exists",
    "physics": "a labeled diagram (Mermaid) plus formula callouts (KaTeX)",
    "chemistry": "a labeled diagram/reaction (Mermaid) plus formula callouts",
    "biology": "a labeled diagram of the structure/process (Mermaid)",
    "history": "a chronological timeline (and map markers if locations matter)",
    "geography": "a timeline or map-marker style key-points slide",
    "programming": "a syntax-highlighted code block with its output plus a Mermaid flow diagram",
    "economics": "a chart/graph (Recharts) plus key points",
    "language": "a clean key-points slide with examples",
    "general": "a clean key-points slide with a relevant simple illustration",
}


def _budget_spec(time_budget_min: int):
    if time_budget_min <= 7:
        return {"concepts": "2 to 3", "depth": "concise — only the single most important idea per concept",
                "checkpoints": "at most 1 quick checkpoint", "examples": "1 tiny example each"}
    if time_budget_min <= 25:
        return {"concepts": "4 to 5", "depth": "clear with one worked example each",
                "checkpoints": "2 to 3 checkpoints spread across the lesson", "examples": "1 example each"}
    return {"concepts": "7 to 9", "depth": "deep, with multiple examples and edge cases",
            "checkpoints": "a checkpoint after most concepts", "examples": "2+ examples each"}


LANG_NAME = {"en": "English", "hi": "Hindi (Devanagari script)"}


async def parse_request(instruction: str, defaults: dict):
    system = ("You convert a learner's free-text request into structured lesson config. "
              "Understand Hinglish (code-mixed Hindi/English). Output JSON only.")
    prompt = f"""Learner request: "{instruction}"

Defaults if a field is not stated: {json.dumps(defaults)}

Return JSON with EXACTLY these keys:
{{
  "topic": "the subject/topic or chapter to teach (string)",
  "level": "beginner | intermediate | advanced",
  "language": "en | hi",
  "time_budget_min": integer minutes (map '5 min'->5, '20 min'->20, '1 hour'->60; if the request is in DAYS put total minutes as days*30),
  "days": integer (1 for a single lesson, >1 if the learner asked for a multi-day plan e.g. '7 days'),
  "style": "short description of preferred teaching style/examples",
  "ask_questions_midlesson": true/false,
  "final_test": true/false,
  "source_scope": "which part of uploaded material, or 'general' if no source referenced"
}}
Detect language intent even from Hinglish. If they say Hindi anywhere, set language 'hi'."""
    data = await llm_service.generate_json(prompt, system, temperature=0.2)
    data.setdefault("level", defaults.get("level", "beginner"))
    data.setdefault("language", defaults.get("language", "en"))
    data.setdefault("time_budget_min", 20)
    data.setdefault("days", 1)
    data.setdefault("ask_questions_midlesson", True)
    data.setdefault("final_test", True)
    return data


async def classify_subject(topic: str):
    system = "You classify a teaching topic into one subject area. Output JSON only."
    prompt = (f'Topic: "{topic}"\nReturn JSON: {{"subject": one of {SUBJECTS}, '
              '"reason": "one short sentence why"}')
    try:
        data = await llm_service.generate_json(prompt, system, temperature=0)
        subj = data.get("subject", "general")
        return (subj if subj in SUBJECTS else "general"), data.get("reason", "")
    except Exception:
        return "general", "defaulted"


async def generate_lesson_plan(config: dict, context: str = "", grounded: bool = False,
                               weak_concepts=None):
    subject, subj_reason = await classify_subject(config["topic"])
    spec = _budget_spec(int(config.get("time_budget_min", 20)))
    lang = config.get("language", "en")
    weak_note = ""
    if weak_concepts:
        weak_note = (f"\nThis returning learner previously struggled with: {', '.join(weak_concepts)}. "
                     "Reference and reinforce these where relevant.")
    src_note = ""
    if context:
        src_note = (f"\n\nGROUND every explanation in this SOURCE MATERIAL. Cite the page_ref in "
                    f"'source_ref' for each segment. If the material lacks a needed detail, teach it from "
                    f"general knowledge but set source_ref to 'general knowledge'.\nSOURCE MATERIAL:\n{context[:9000]}")

    system = (f"You are an expert teacher and instructional designer. You design a real lesson "
              f"(not a chatbot answer) in {LANG_NAME.get(lang)}. Output JSON only, valid and complete.")
    prompt = f"""Design a lesson.
Topic: {config['topic']}
Subject area (already classified): {subject} -> visual rule: {VISUAL_RULES[subject]}
Learner level: {config.get('level')}
Teaching language: {LANG_NAME.get(lang)}  (ALL 'script' and 'on_screen_text' MUST be in this language)
Time budget: {config.get('time_budget_min')} minutes -> produce {spec['concepts']} concepts, {spec['depth']}, {spec['checkpoints']}, {spec['examples']}.
Style: {config.get('style', 'clear and friendly')}{weak_note}{src_note}

Return JSON:
{{
 "topic": "...",
 "subject": "{subject}",
 "summary": "one-sentence lesson summary",
 "segments": [
   {{
     "concept": "concept name",
     "objective": "what the learner will be able to do",
     "depth": "beginner|intermediate|advanced",
     "subject": "{subject}",
     "visual_type": "math|physics|chemistry|biology|history|geography|programming|economics|keypoints",
     "visual_reason": "one line: which rule chose this visual type",
     "visual_spec": {{
        "points": ["key bullet", "..."],
        "equations": ["LaTeX string without $ delimiters"],
        "steps": ["worked step 1", "..."],
        "graph": {{"title":"","x_label":"","y_label":"","series":[{{"name":"","data":[{{"x":0,"y":0}}]}}]}},
        "diagram_mermaid": "valid mermaid code (graph TD; ...) or empty",
        "timeline": [{{"year":"","event":""}}],
        "map_markers": [{{"place":"","note":""}}],
        "code": "", "code_language": "", "code_output": "",
        "formulas": ["LaTeX"],
        "illustration_query": "2-4 word image search query"
     }},
     "script": "the spoken narration (2-5 sentences, in the teaching language, warm and clear)",
     "on_screen_text": ["short on-screen bullet", "..."],
     "source_ref": "page ref or 'general knowledge'",
     "checkpoint": null OR {{
        "type": "mcq|short_answer|problem|explain|application",
        "question": "the question in the teaching language",
        "options": ["A","B","C","D"] (only for mcq, else []),
        "answer": "correct answer / key idea",
        "concept": "the concept being tested"
     }}
   }}
 ]
}}
Only include visual_spec fields relevant to the visual_type; leave others empty. Place checkpoints on some (not all) segments per the budget. {'Make sure at least the requested mid-lesson questions exist.' if config.get('ask_questions_midlesson', True) else 'Keep checkpoints minimal.'}"""
    plan = await llm_service.generate_json(prompt, system, temperature=0.5)
    plan["subject"] = subject
    plan["subject_reason"] = subj_reason
    plan["grounded"] = grounded
    for seg in plan.get("segments", []):
        seg.setdefault("visual_type", subject if subject != "general" else "keypoints")
        seg.setdefault("visual_spec", {})
        seg.setdefault("on_screen_text", [])
        seg.setdefault("checkpoint", None)
        seg.setdefault("source_ref", "general knowledge")
    return plan


async def generate_multiday_plan(config: dict):
    subject, _ = await classify_subject(config["topic"])
    days = int(config.get("days", 3))
    lang = config.get("language", "en")
    system = f"You design multi-day study plans in {LANG_NAME.get(lang)}. Output JSON only."
    prompt = f"""Create a {days}-day learning plan for "{config['topic']}" for a {config.get('level')} learner.
Language: {LANG_NAME.get(lang)}.
Return JSON: {{"topic":"...","days":[{{"day":1,"title":"...","topics":["...","..."],"goal":"...","est_minutes":30}}]}}
Distribute topics logically from foundations to advanced across exactly {days} days."""
    data = await llm_service.generate_json(prompt, system, temperature=0.4)
    data["subject"] = subject
    return data


async def generate_learning_path(topic: str, level: str = "beginner", language: str = "en"):
    system = f"You are a curriculum architect. Output JSON only in {LANG_NAME.get(language)}."
    prompt = f"""Build an ordered learning path (curriculum) to master "{topic}" for a {level} learner.
Return JSON: {{"topic":"...","steps":[{{"title":"step title","detail":"one line what it covers"}}]}}
Order from prerequisites to advanced. 5 to 8 steps."""
    data = await llm_service.generate_json(prompt, system, temperature=0.4)
    return data


async def evaluate_answer(question: str, student_answer: str, concept: str, correct: str,
                          language: str = "en", context: str = ""):
    system = (f"You are a precise, encouraging tutor grading one answer in {LANG_NAME.get(language)}. "
              "If wrong or partial, name the SPECIFIC misconception, don't just mark it wrong. Output JSON only.")
    ctx = f"\nRelevant source material:\n{context[:2500]}" if context else ""
    prompt = f"""Concept: {concept}
Question: {question}
Expected/key answer: {correct}
Learner's answer: "{student_answer}"{ctx}

Return JSON:
{{
 "verdict": "correct | partial | incorrect",
 "score": 0.0 to 1.0,
 "misconception": "the specific wrong idea the learner holds, or '' if correct",
 "feedback": "2-3 sentences of warm, specific feedback in the teaching language"
}}"""
    data = await llm_service.generate_json(prompt, system, temperature=0.2)
    data.setdefault("verdict", "partial")
    data.setdefault("score", 0.5)
    data.setdefault("misconception", "")
    return data


async def adapt_reteach(concept: str, misconception: str, level: str, language: str = "en"):
    system = (f"You re-teach a concept differently in {LANG_NAME.get(language)} after a learner erred. "
              "Use a NEW analogy and a NEW example. Output JSON only.")
    prompt = f"""Concept: {concept}
Learner's misconception: {misconception or 'general confusion'}
Level: {level}
Re-explain using a DIFFERENT analogy and a fresh example, then ask ONE short follow-up question.
Return JSON:
{{
 "script": "the re-explanation narration (teaching language, new analogy + new example)",
 "on_screen_text": ["bullet","..."],
 "analogy": "the analogy used",
 "followup": {{"type":"short_answer","question":"...","answer":"key idea","concept":"{concept}"}}
}}"""
    return await llm_service.generate_json(prompt, system, temperature=0.6)


async def generate_assessment(plan: dict, language: str = "en"):
    concepts = [s.get("concept", "") for s in plan.get("segments", [])]
    n = max(3, min(8, len(concepts) + 1))
    system = f"You write a fair end-of-lesson quiz in {LANG_NAME.get(language)}. Output JSON only."
    prompt = f"""Lesson topic: {plan.get('topic')}
Concepts taught: {concepts}
Write {n} questions covering ONLY what was taught. Mix MCQ and short-answer.
Return JSON:
{{"questions":[{{"id":1,"type":"mcq|short_answer","question":"...","options":["A","B","C","D"] or [],"answer":"correct answer","concept":"which concept"}}]}}"""
    data = await llm_service.generate_json(prompt, system, temperature=0.4)
    return data


async def grade_assessment(plan: dict, questions: list, answers: dict, language: str = "en"):
    system = f"You grade a quiz and write a learner report in {LANG_NAME.get(language)}. Output JSON only."
    qa = [{"question": q["question"], "concept": q.get("concept", ""),
           "correct": q.get("answer", ""), "learner_answer": answers.get(str(q.get("id")), "")}
          for q in questions]
    prompt = f"""Topic: {plan.get('topic')}
Graded items: {json.dumps(qa, ensure_ascii=False)[:6000]}

Grade each, then return JSON:
{{
 "score": 0-100 integer (percent),
 "per_question": [{{"concept":"...","correct":true/false}}],
 "strong_areas": ["concept", "..."],
 "weak_areas": ["concept", "..."],
 "incorrect_concepts": ["..."],
 "recommendation": "one specific revision action in the teaching language",
 "next_topic": "a suggested next topic"
}}"""
    data = await llm_service.generate_json(prompt, system, temperature=0.2)
    data.setdefault("score", 0)
    data.setdefault("strong_areas", [])
    data.setdefault("weak_areas", [])
    return data
