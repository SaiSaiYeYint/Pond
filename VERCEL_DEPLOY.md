# Vercel Deploy Notes

This prototype can deploy to Vercel with a serverless Grimm bridge.

## Upload

Upload or import the whole `Grimm App` folder to Vercel.

Required for the phone web test:
- `index.html`
- `app.js`
- `assets/`
- `api/`
- `grimm/`
- `vercel.json`

Optional local-only files:
- `server.js`
- `.env.example`
- `start-grimm-bridge.ps1`
- `CLAUDE_TESTING.md`
- `GRIMM_API_CONTRACT.md`

## Current AI Behavior

The deployed site calls `/api/grimm`. Add `OPENAI_API_KEY` in Vercel environment variables for real Grimm replies. If no key is present and `MOCK_GRIMM_WITHOUT_KEY` is not set to `false`, the endpoint returns mock Grimm replies for testing.

Optional environment variables:
- `OPENAI_MODEL=gpt-4.1-mini`
- `ANTHROPIC_API_KEY=...`
- `CLAUDE_MODEL=claude-sonnet-4-20250514`
- `MOCK_GRIMM_WITHOUT_KEY=true`

Persistent cross-device memory still needs a real database. Local development uses `data/*.json`; Vercel currently returns structured updates for the browser to store locally.
