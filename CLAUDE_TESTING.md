# Claude Test Setup

You do not need Claude Code. You need a Claude API key.

## Files

Frontend:
- `index.html`
- `app.js`
- `assets/`

Claude bridge:
- `server.js`
- `package.json`
- `.env`

Reference:
- `GRIMM_API_CONTRACT.md`

## Setup

1. Copy `.env.example` to `.env`.
2. Put your Anthropic API key in `.env`:

```text
ANTHROPIC_API_KEY=your_real_key_here
PORT=8787
CLAUDE_MODEL=claude-sonnet-4-20250514
MOCK_GRIMM_WITHOUT_KEY=true
```

3. Dependencies are installed with:

```text
pnpm install
```

4. Start Claude bridge:

```text
.\start-grimm-bridge.ps1
```

5. In the app, open Grimm chat and type:

```text
api endpoint: http://127.0.0.1:8787/grimm
```

6. Test:

```text
api status
```

Then log something like:

```text
i cleaned my desk for 10 minutes
```

If Claude is connected, Grimm's judgment comes from Claude. If the server fails, the app falls back to local Grimm.

If you have not added a Claude key yet, the bridge runs in mock mode so you can still test the app-to-backend flow.

## Hidden Grimm Commands

```text
api status
api off
case report
case reset
```

## Health Check

Open this in a browser:

```text
http://127.0.0.1:8787/health
```

Expected:

```json
{
  "ok": true,
  "model": "claude-sonnet-4-20250514",
  "hasApiKey": true,
  "mode": "claude"
}
```
