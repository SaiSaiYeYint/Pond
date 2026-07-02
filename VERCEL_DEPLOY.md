# Vercel Deploy Notes

This prototype can deploy as a static site.

## Upload

Upload or import the whole `Grimm App` folder to Vercel.

Required for the phone web test:
- `index.html`
- `app.js`
- `assets/`
- `vercel.json`

Optional local-only files:
- `server.js`
- `.env.example`
- `start-grimm-bridge.ps1`
- `CLAUDE_TESTING.md`
- `GRIMM_API_CONTRACT.md`

## Current AI Behavior

The deployed site will run local Grimm logic in the browser. The Claude bridge in `server.js` is still local Express code and is not deployed by this static Vercel setup.

For the next phase, move the `/grimm` endpoint into a Vercel serverless API route and set `ANTHROPIC_API_KEY` in Vercel environment variables.
