"""The single seed demo subject: a physics lesson on Newton's Laws of Motion for a
Class 8 learner. Fully static so it works with ZERO setup even if all LLM/TTS
providers are down. Segment 0 is marked to use ElevenLabs (showcase quality);
everything else defaults to the free Web Speech / edge-tts path."""

SEED_PLAN_ID = "seed_newtons_laws"

SEED_PLAN = {
    "plan_id": SEED_PLAN_ID,
    "user_id": "seed",
    "topic": "Newton's Laws of Motion",
    "subject": "physics",
    "subject_reason": "Rule: motion/forces topic -> physics -> labeled diagram + formula callouts.",
    "level": "beginner",
    "language": "en",
    "time_budget_min": 20,
    "source_material_id": None,
    "grounded": False,
    "is_seed": True,
    "summary": "The three laws that describe how forces change the motion of objects.",
    "segments": [
        {
            "concept": "What is a Force?",
            "objective": "Explain that a force is a push or pull that can change an object's motion.",
            "depth": "beginner",
            "subject": "physics",
            "visual_type": "physics",
            "visual_reason": "Rule: physics topic -> labeled diagram (Mermaid) + formula callout (KaTeX).",
            "tts_provider": "elevenlabs",
            "visual_spec": {
                "points": ["A force is a push or a pull.", "Forces can start, stop, speed up, slow down or turn an object.",
                           "Force is measured in newtons (N)."],
                "diagram_mermaid": "graph LR; A[Hand] -->|push| B[Box]; B -->|moves right| C[New Position];",
                "formulas": ["F = m \\times a"],
                "illustration_query": "pushing box physics"
            },
            "script": "Let's begin with the most basic idea in this chapter: a force. A force is simply a push or a pull. When you push a door open or pull a drawer out, you are applying a force. Forces can make things start moving, stop moving, go faster, slow down, or change direction. We measure force in units called newtons.",
            "on_screen_text": ["Force = a push or a pull", "Changes motion of objects", "Measured in newtons (N)"],
            "source_ref": "general knowledge",
            "checkpoint": {
                "type": "mcq",
                "question": "Which of these is an example of a force?",
                "options": ["Kicking a football", "The colour of a ball", "The name of a ball", "The smell of grass"],
                "answer": "Kicking a football",
                "concept": "What is a Force?"
            }
        },
        {
            "concept": "Newton's First Law (Inertia)",
            "objective": "State that an object stays at rest or in uniform motion unless acted on by a net force.",
            "depth": "beginner",
            "subject": "physics",
            "visual_type": "physics",
            "visual_reason": "Rule: physics topic -> labeled diagram (Mermaid) + formula callout (KaTeX).",
            "tts_provider": "web",
            "visual_spec": {
                "points": ["An object at rest stays at rest.", "An object in motion stays in motion in a straight line.",
                           "...unless a net (unbalanced) force acts on it.", "This resistance to change is called inertia."],
                "diagram_mermaid": "graph TD; R[Object at rest] -->|no net force| R2[Stays at rest]; M[Object moving] -->|no net force| M2[Keeps moving straight];",
                "formulas": ["\\Sigma F = 0 \\Rightarrow v = \\text{constant}"],
                "illustration_query": "inertia seatbelt car"
            },
            "script": "Newton's first law is about inertia. It says that an object will keep doing what it is already doing. If it is at rest, it stays at rest. If it is moving, it keeps moving in a straight line at the same speed, unless an unbalanced force acts on it. This is why you lurch forward when a bus suddenly stops: your body wants to keep moving.",
            "on_screen_text": ["Objects resist changes in motion", "Rest stays rest, motion stays motion", "This resistance = inertia"],
            "source_ref": "general knowledge",
            "checkpoint": {
                "type": "short_answer",
                "question": "In your own words, why do passengers jerk forward when a moving bus brakes suddenly?",
                "options": [],
                "answer": "Because of inertia — their bodies tend to keep moving forward even though the bus stops.",
                "concept": "Newton's First Law (Inertia)"
            }
        },
        {
            "concept": "Newton's Second Law (F = ma)",
            "objective": "Use F = ma to relate force, mass, and acceleration.",
            "depth": "beginner",
            "subject": "physics",
            "visual_type": "physics",
            "visual_reason": "Rule: physics topic -> labeled diagram + formula callout; includes a worked calculation.",
            "tts_provider": "web",
            "visual_spec": {
                "points": ["Force = mass x acceleration.", "More force -> more acceleration.",
                           "More mass -> less acceleration for the same force."],
                "formulas": ["F = m \\times a", "a = \\dfrac{F}{m}"],
                "steps": ["A 2 kg ball is pushed with 10 N.", "a = F / m = 10 / 2", "a = 5 m/s^2"],
                "diagram_mermaid": "graph LR; F[Force 10N] --> B[Ball 2kg]; B --> A[Acceleration 5 m/s2];",
                "illustration_query": "force mass acceleration"
            },
            "script": "The second law gives us a formula: force equals mass times acceleration, written F equals m a. It tells us that the bigger the force, the more an object accelerates. But the heavier the object, the less it accelerates for the same force. For example, if you push a two kilogram ball with a force of ten newtons, its acceleration is ten divided by two, which is five metres per second squared.",
            "on_screen_text": ["F = m x a", "Bigger force -> bigger acceleration", "Bigger mass -> smaller acceleration"],
            "source_ref": "general knowledge",
            "checkpoint": {
                "type": "problem",
                "question": "A 4 kg box is pushed with a force of 12 N. What is its acceleration?",
                "options": [],
                "answer": "a = F/m = 12/4 = 3 m/s^2",
                "concept": "Newton's Second Law (F = ma)"
            }
        },
        {
            "concept": "Newton's Third Law (Action-Reaction)",
            "objective": "Explain that every action has an equal and opposite reaction.",
            "depth": "beginner",
            "subject": "physics",
            "visual_type": "physics",
            "visual_reason": "Rule: physics topic -> labeled diagram of paired forces.",
            "tts_provider": "web",
            "visual_spec": {
                "points": ["For every action there is an equal and opposite reaction.", "Forces always come in pairs.",
                           "The two forces act on different objects."],
                "diagram_mermaid": "graph LR; S[Swimmer pushes water back] -->|reaction| W[Water pushes swimmer forward];",
                "formulas": ["F_{AB} = -F_{BA}"],
                "illustration_query": "rocket launch action reaction"
            },
            "script": "The third law says that for every action, there is an equal and opposite reaction. Forces always come in pairs. When a swimmer pushes water backwards, the water pushes the swimmer forwards with an equal force. A rocket works the same way: it pushes gas down, and the gas pushes the rocket up.",
            "on_screen_text": ["Every action -> equal & opposite reaction", "Forces act in pairs", "The pair acts on different objects"],
            "source_ref": "general knowledge",
            "checkpoint": {
                "type": "application",
                "question": "When a rocket pushes hot gas downwards, what makes the rocket move up?",
                "options": [],
                "answer": "The reaction force: the gas pushes the rocket up with an equal and opposite force.",
                "concept": "Newton's Third Law (Action-Reaction)"
            }
        }
    ]
}

SEED_ASSESSMENT = {
    "questions": [
        {"id": 1, "type": "mcq", "question": "A force is best described as:",
         "options": ["A push or a pull", "A type of energy", "A colour", "A shape"],
         "answer": "A push or a pull", "concept": "What is a Force?"},
        {"id": 2, "type": "short_answer", "question": "What does inertia mean?",
         "options": [], "answer": "The tendency of an object to resist changes to its motion.",
         "concept": "Newton's First Law (Inertia)"},
        {"id": 3, "type": "problem", "question": "A 5 kg object accelerates at 2 m/s^2. What net force acts on it?",
         "options": [], "answer": "F = ma = 5 x 2 = 10 N", "concept": "Newton's Second Law (F = ma)"},
        {"id": 4, "type": "mcq", "question": "Newton's third law says forces:",
         "options": ["Come in equal and opposite pairs", "Always cancel to zero on one object",
                     "Only act on heavy objects", "Do not exist in space"],
         "answer": "Come in equal and opposite pairs", "concept": "Newton's Third Law (Action-Reaction)"},
    ]
}


async def ensure_seed(db):
    existing = await db.lesson_plans.find_one({"plan_id": SEED_PLAN_ID}, {"_id": 0})
    if not existing:
        await db.lesson_plans.insert_one(dict(SEED_PLAN))
    await db.seed_assessments.update_one(
        {"plan_id": SEED_PLAN_ID}, {"$set": {"plan_id": SEED_PLAN_ID, **SEED_ASSESSMENT}}, upsert=True)
