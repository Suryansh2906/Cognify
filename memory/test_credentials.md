# Test Credentials — AI Teacher

Auth: Emergent-managed Google OAuth (no app-managed passwords).

## Automated test identity (pre-seeded in `test_database`)
Use this to test auth-gated pages by setting the cookie / Bearer token.
- user_id: `test-user-1`
- email: `test@aiteacher.dev`
- session_token: `test_session_main`  (valid 7 days; set as cookie `session_token` or `Authorization: Bearer test_session_main`)
- profile: onboarded=true, level=beginner, language=en

To (re)create it:
```
mongosh test_database --eval '
var uid="test-user-1"; var tok="test_session_main";
db.users.deleteMany({user_id:uid}); db.user_sessions.deleteMany({user_id:uid}); db.learner_profiles.deleteMany({user_id:uid});
db.users.insertOne({user_id:uid,email:"test@aiteacher.dev",name:"Test Learner",picture:"",created_at:new Date().toISOString()});
db.user_sessions.insertOne({user_id:uid,session_token:tok,expires_at:new Date(Date.now()+7*24*3600*1000).toISOString(),created_at:new Date().toISOString()});
db.learner_profiles.insertOne({user_id:uid,default_level:"beginner",preferred_languages:["en"],preferred_style:"clear",onboarded:true,topics_studied:[],strong_concepts:[],weak_concepts:[],score_history:[],current_learning_path_id:null});'
```

## Public (no auth) surfaces
- `/` landing, `/docs`, `/demo` (seed Newton's Laws lesson), `GET /api/demo/lesson`, `GET /api/admin/llm-status`, `POST /api/admin/simulate-failure`.

## Admin/debug
- `/admin` (in-app) shows active LLM provider + fallback toggles.
