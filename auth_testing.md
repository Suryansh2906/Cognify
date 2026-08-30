# Auth-Gated App Testing Playbook (AI Teacher)

Auth = Emergent Google OAuth. For automated testing, inject a session into `test_database` and set the cookie/Bearer. Do NOT attempt the real Google popup.

## Step 1 — Create Test User & Session
```
mongosh test_database --eval '
var uid="test-user-1"; var tok="test_session_main";
db.users.insertOne({user_id:uid,email:"test@aiteacher.dev",name:"Test Learner",picture:"",created_at:new Date().toISOString()});
db.user_sessions.insertOne({user_id:uid,session_token:tok,expires_at:new Date(Date.now()+7*24*3600*1000).toISOString(),created_at:new Date().toISOString()});
db.learner_profiles.insertOne({user_id:uid,default_level:"beginner",preferred_languages:["en"],preferred_style:"clear",onboarded:true,topics_studied:[],strong_concepts:[],weak_concepts:[],score_history:[],current_learning_path_id:null});'
```

## Step 2 — Backend API (Bearer)
```
curl -H "Authorization: Bearer test_session_main" $URL/api/auth/me
curl -X POST $URL/api/lessons/plan -H "Authorization: Bearer test_session_main" -H "Content-Type: application/json" -d '{"topic":"Newtons Laws","level":"beginner","language":"en","time_budget_min":5,"days":1}'
```

## Step 3 — Browser (cookie)
```
await page.context.add_cookies([{ "name":"session_token","value":"test_session_main",
 "domain":"<host>","path":"/","httpOnly":true,"secure":true,"sameSite":"None"}])
await page.goto("<URL>/dashboard")
```

## Notes
- Queries must use `{_id:0}` projection; user_id is a custom UUID.
- Callback detection uses `useLocation().hash`.
- DB name is `test_database` (matches `DB_NAME`).
