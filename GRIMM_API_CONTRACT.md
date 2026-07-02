# Grimm API Contract

The browser app is ready to call a local backend endpoint for Claude. Keep the Claude API key on the backend. Do not put the key in `index.html` or `app.js`.

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

If no endpoint is configured, Grimm uses the local fallback judge and chat personality.

## Request Shape

The app sends `POST` JSON:

```json
{
  "task": "judge",
  "input": {
    "text": "i finished a prototype test"
  },
  "model": "claude",
  "system": "Grimm personality and rules",
  "caseStudy": {
    "profile": {},
    "theories": [],
    "recentEvidence": [],
    "todayDone": [],
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
  "theory": "Concrete proof increases follow-through."
}
```

Use `valid: false` when the user typed chat, a vague statement, or a plan instead of a finished activity.

## Chat Response

Return JSON only:

```json
{
  "reply": "Noted. Now bring me proof.",
  "theory": "User tests boundaries before logging action."
}
```

`theory` is optional and hidden from the UI. It feeds Grimm's private case study.
