# Grimm API Contract

The browser app calls a backend bridge for Grimm. Keep OpenAI or Claude API keys on the backend. Do not put keys in `index.html` or `app.js`.

Default endpoints:
- Local file/local dev: `http://127.0.0.1:8787/grimm`
- Vercel: `/api/grimm`

## Enable In The Prototype

Open Grimm chat and send:

```text
api endpoint: http://127.0.0.1:8787/grimm
```

Other hidden setup commands:

```text
api status
api off
```

If no API key exists, the bridge can run mock Grimm for testing. If the bridge is unavailable, the app falls back to local Grimm.

## Request Shape

The app sends `POST` JSON:

```json
{
  "task": "judge",
  "input": {
    "text": "i finished a prototype test"
  },
  "model": "openai",
  "system": "Grimm personality and rules",
  "caseStudy": {
    "profile": {},
    "theories": [],
    "recentEvidence": [],
    "todayDone": [],
    "todayGoal": null,
    "feedback": [],
    "notebook": [],
    "codexTasks": [],
    "workTime": false,
    "coins": 120,
    "trophies": 0
  },
  "responseContract": {}
}
```

For chat, `task` is `"chat"` and `input` contains:

```json
{
  "text": "what do you think?",
  "recentChat": []
}
```

## Judge Response

Return JSON only:

```json
{
  "valid": true,
  "score": 12,
  "grimm": "Useful enough. I allow it.",
  "theory": "Concrete proof increases follow-through.",
  "memoryUpdate": {},
  "feedbackUpdate": null,
  "notebookUpdate": null,
  "goalUpdate": null
}
```

Use `valid: false` when the user typed chat, a vague statement, or a plan instead of a finished activity.

## Chat Response

Return JSON only:

```json
{
  "reply": "Noted. Now bring me proof.",
  "coinsDelta": 0,
  "memoryUpdate": {},
  "feedbackUpdate": null,
  "notebookUpdate": null,
  "goalUpdate": null,
  "codexTask": null,
  "mode": "normal",
  "theory": "User tests boundaries before logging action."
}
```

`theory` is optional and hidden from the UI. It feeds Grimm's private case study.

Simon Says commands return `mode: "admin"` or `mode: "workshop"` and may include `codexTask`. They never award coins.
