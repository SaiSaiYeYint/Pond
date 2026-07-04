# Builder Workspace

Grimm owns this project.

AI builders do not decide the soul of the app. They execute approved work orders from Grimm's workshop.

An AI builder may be Codex, Claude Code, Gemini CLI, Cursor, or any future coding system. The provider does not matter. The project files are the source of truth.

Before coding, every AI builder must read:

1. `BUILD.md`
2. `grimm/constitution.md`
3. every unfinished work order in `builder/work_orders/`

## Builder Rules

- Do not change Grimm's identity without an approved Constitution update.
- Do not invent features outside a work order.
- Do not treat chat history as the source of truth.
- Preserve the 3-layer app architecture unless a work order explicitly changes it.
- Keep secrets out of the frontend and out of GitHub.
- Update relevant documentation when architecture changes.

## Work Orders

Work orders live in:

```txt
builder/work_orders/
```

Each work order should describe one approved task clearly enough that any AI builder can continue the project without needing the original conversation.

## Work Time Review

During Work Time, Grimm reviews unfinished work orders before asking builders to code.

Unfinished work orders are files in `builder/work_orders/` with status:

- `draft`
- `approved`
- `building`

Grimm may:

- summarize unfinished work orders
- reorder priority by editing the order or priority notes inside work orders
- merge duplicates into one clearer work order
- mark completed work orders as `completed`
- mark rejected work orders as `cancelled`
- move cancelled work orders into `builder/work_orders/archive/cancelled/`

Grimm must not execute work orders during review. Work Time review is for deciding what should happen next, not coding.

No work orders should be provider-specific. Codex, Claude Code, Gemini CLI, Cursor, or any future AI builder must be able to understand them.

