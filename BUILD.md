# Grimm App Build Notes

## Start Here

Every AI builder must read `builder/PROJECT_STATE.md` before changing code. It is the single source of truth for the current project state, current priority, stable systems, and next planned work.

## Current Prototype

This is a static pond app prototype. The app itself is not called Grimm. Grimm is the AI character/chat presence inside the app.

The current build focuses on three things:

- A living pond background with fish and feeding.
- A Done List page with week tracking and coin feedback.
- A top-level Grimm chat layer that can minimize, maximize, and enter keyboard mode.

## Architecture

The UI is organized into three layers.

### pondLayer

Bottom layer.

- Full viewport pond canvas.
- Fish movement and feeding visuals.
- Never moves for keyboard.
- Never uses page layout rules.
- Feeding only works when the app is in Pond view and chat is minimized.

### pageLayer

Middle layer.

- Holds app pages.
- Current first page is the Done List and week tracker.
- Future pages should swipe horizontally here.
- Hidden when chat is maximized or keyboard mode is active.
- Does not respond to keyboard lift.

### chatLayer

Top layer.

- Header.
- Quick preview bubbles.
- Full chat history.
- Grimm orb.
- Composer input.
- Owns keyboard mode.

Do not let future features move pondLayer or pageLayer for keyboard behavior. Keyboard behavior belongs to chatLayer.

## Chat States

The app uses one chat state system:

```html
data-chat-state="minimized"
data-chat-state="maximized"
data-chat-state="keyboard"
```

### Minimized

- Page layer is visible unless Pond view is active.
- Quick bubbles can appear above the composer.
- Full chat history is hidden.
- Grimm orb and composer sit in the bottom chat dock.

### Maximized

- Page layer is hidden.
- Pond remains visible behind chat.
- Header is hidden for a cleaner full-chat look.
- Chat history scrolls internally.
- Chat dock stays at the bottom.

### Keyboard

- Triggered by input focus and visualViewport keyboard detection.
- Header hidden.
- Page layer hidden.
- Pond stays fixed.
- Body/document scroll is pinned.
- Chat dock moves with `--keyboard-lift`.
- Chat messages resize above the dock and scroll internally.
- Closing keyboard restores the previous state.

## Chat Dock

The Grimm orb and composer are grouped in `chatDock`.

Rules:

- Orb and input must move together.
- Do not position the orb independently from the composer except inside the dock.
- Do not make separate minimized/maximized dock positions unless intentionally changing the whole dock.
- Keyboard lift should move the dock, not the pond or page.

Main layout variables:

```css
--chat-width
--dock-width
--chat-top
--dock-bottom
--messages-bottom
--dock-shift
--orb-left
--keyboard-lift
```

## Keyboard Mode Guardrails

Keyboard mode exists because iOS Safari tries to scroll focused inputs into view.

Current protections:

- Input focus immediately enters keyboard state on touch/coarse pointer devices.
- `focus({ preventScroll: true })` is used when possible.
- The window is pinned back to scroll top during keyboard opening.
- `visualViewport` calculates keyboard lift.
- Touch scrolling outside the chat log is prevented during keyboard mode.

Do not replace this with random CSS offsets. Treat keyboard mode as a temporary app state.

## Pond Rules

Pond/Home button toggles between app page and pond view.

Feeding rule:

- Only feed fish when `view === "pond"`.
- Only feed when chat state is minimized.
- Feeding costs 1 coin.
- Uneaten food fades/disappears after a short time.

The Done List page must not feed fish through transparent areas.

## Done List Rules

The Done List stores concrete user actions.

Current behavior:

- User sends a message/log through the composer.
- If it looks like a concrete activity, it is added to Today's Done.
- Grimm judges it and applies coin gain/loss.
- Vague chat should not always award coins.
- Trophies are for reaching today's goal, not normal logs.

## Grimm Status

Current Grimm uses `GrimmService` as the only AI entry point.

Provider:

- Google AI Studio / Gemini through `GEMINI_API_KEY`.
- Default model: `gemini-2.5-flash`.
- The UI never calls Gemini directly.
- The UI calls the local/Vercel Grimm endpoint, which calls `GrimmService`.
- Future AI providers should plug into `GrimmService`, not into the UI.

Memory:

- `MemoryService` wraps local player memory.
- Supabase is not implemented yet.
- Grimm loads `grimm/constitution.md` before every AI request.

Input contract:

```js
{
  message,
  mode,
  playerMemory,
  recentMessages
}
```

Output contract:

```js
{
  reply,
  memoryUpdate,
  coinsDelta,
  suggestedActions
}
```

Grimm should feel:

- Dry.
- Playful.
- Slightly judgmental.
- Warm underneath.
- Not like ChatGPT.

The app contains provider-agnostic Grimm documents in the `grimm/` folder. Those files are intended to let Gemini, OpenAI, Claude, Codex, or future AI systems share the same Grimm identity and rules later.

## Do Not Break

Future agents should avoid these mistakes:

- Do not move pondLayer for keyboard.
- Do not move pageLayer for keyboard.
- Do not add multiple competing chat state classes.
- Do not use `!important` as a layout fix.
- Do not make the composer and orb separate moving objects.
- Do not let body/document scroll in keyboard mode.
- Do not let Done List screen feed fish.
- Do not turn Grimm into a generic assistant.

## Next Development Moves

Recommended order:

1. Final architecture audit.
2. Clean remaining CSS duplication and mobile overrides.
3. Improve Grimm's local conversation logic.
4. Add real AI backend later, without exposing API keys.
5. Improve pond visuals and fish behavior.
6. Add future app pages inside pageLayer.
7. Expand Grimm memory, feedback, notebook, and workshop systems.
