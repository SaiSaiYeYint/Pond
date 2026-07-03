import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const app = express();
const port = Number(process.env.PORT || 8787);
const model = process.env.OPENAI_MODEL || process.env.CLAUDE_MODEL || "gpt-4.1-mini";
const openaiKey = process.env.OPENAI_API_KEY;
const apiKey = process.env.ANTHROPIC_API_KEY;
const mockWithoutKey = process.env.MOCK_GRIMM_WITHOUT_KEY !== "false";
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
const dataDir = join(process.cwd(), "data");

app.use(cors({ origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/] }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    model,
    hasApiKey: Boolean(openaiKey || apiKey),
    mode: openaiKey ? "openai" : apiKey ? "claude" : mockWithoutKey ? "mock" : "missing-key"
  });
});

app.get("/grimm/state", (_req, res) => {
  res.json(loadStore());
});

app.post("/grimm", async (req, res) => {
  try {
    ensureStore();
    const payload = normalizePayload(req.body);
    const store = loadStore();

    if (!openaiKey && !anthropic && mockWithoutKey) {
      const clean = payload.task === "judge" ? mockJudge(payload.input?.text || "") : mockChat(payload.input?.text || "");
      const structured = applyStructuredUpdates(clean, payload, store);
      return res.json(structured);
    }

    if (!openaiKey && !anthropic) {
      return res.status(503).json({
        error: "missing_api_key",
        message: "Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env and restart the server."
      });
    }

    const text = openaiKey ? await callOpenAI(payload) : await callClaude(payload);

    const json = parseJson(text);
    const clean = payload.task === "judge" ? cleanJudge(json) : cleanChat(json);
    res.json(applyStructuredUpdates(clean, payload, store));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "grimm_failed",
      message: error instanceof Error ? error.message : "Unknown server error"
    });
  }
});

app.listen(port, () => {
  console.log(`Grimm bridge listening on http://127.0.0.1:${port}`);
});

async function callClaude(payload) {
  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
    max_tokens: 260,
    temperature: 0.85,
    system: payload.system,
    messages: [{ role: "user", content: buildPrompt(payload) }]
  });
  return response.content
    .filter(part => part.type === "text")
    .map(part => part.text)
    .join("\n")
    .trim();
}

async function callOpenAI(payload) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.85,
      max_tokens: 260,
      messages: [
        { role: "system", content: payload.system },
        { role: "user", content: buildPrompt(payload) }
      ]
    })
  });
  if (!response.ok) throw new Error(`OpenAI failed: ${response.status}`);
  const data = await response.json();
  return String(data.choices?.[0]?.message?.content || "").trim();
}

function normalizePayload(body) {
  const task = body?.task === "chat" ? "chat" : "judge";
  return {
    task,
    input: body?.input || {},
    system: String(body?.system || defaultSystem()),
    caseStudy: body?.caseStudy || {},
    responseContract: body?.responseContract || {}
  };
}

function buildPrompt(payload) {
  const brain = loadGrimmBrain();
  const contract = payload.task === "judge"
    ? `Return JSON only with this shape:
{"valid": boolean, "score": number, "grimm": string, "theory": string, "memoryUpdate": object, "feedbackUpdate": object|null, "notebookUpdate": object|null, "goalUpdate": object|null}

Scoring:
- valid false for chat, vague text, future plans, or fake productivity.
- score must be between -24 and 44.
- grimm must be short, in Grimm's voice, no generic praise.
- theory is hidden case-file learning, not shown directly to user.
- trophies are only for stored goal completion.`
    : `Return JSON only with this shape:
{"reply": string, "coinsDelta": number, "memoryUpdate": object, "feedbackUpdate": object|null, "notebookUpdate": object|null, "goalUpdate": object|null, "codexTask": string|null, "mode": "normal"|"admin"|"workshop", "theory": string}

Rules:
- reply must be short, in Grimm's voice.
- theory is optional hidden case-file learning.
- Simon Says commands are admin/workshop and never award coins.`;

  return [
    `Task: ${payload.task}`,
    "",
    "Grimm source-of-truth files:",
    brain,
    "",
    contract,
    "",
    "User input:",
    JSON.stringify(payload.input, null, 2),
    "",
    "Hidden case study:",
    JSON.stringify(payload.caseStudy, null, 2),
    "",
    "Shared storage:",
    JSON.stringify(loadStore(), null, 2),
    "",
    "Do not include markdown. Do not wrap JSON in code fences."
  ].join("\n");
}

function loadGrimmBrain() {
  const files = [
    "grimm/constitution.md",
    "grimm/operating_manual.md",
    "grimm/prompts/grimm_normal.md",
    "grimm/prompts/grimm_workshop.md",
    "grimm/prompts/grimm_memory_update.md"
  ];
  return files.map(file => {
    try {
      return `--- ${file} ---\n` + readFileSync(join(process.cwd(), file), "utf8");
    } catch {
      return `--- ${file} missing ---`;
    }
  }).join("\n\n");
}

function ensureStore() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const defaults = {
    "player_memory.json": {
      playerId: "local-player",
      version: 1,
      facts: [],
      preferences: [],
      patterns: [],
      goals: [],
      relationship: [],
      updatedAt: new Date().toISOString()
    },
    "feedback.json": { items: [] },
    "notebook.json": { entries: [] },
    "codex_tasks.json": { items: [] }
  };
  for (const [name, value] of Object.entries(defaults)) {
    const path = join(dataDir, name);
    if (!existsSync(path)) writeJson(path, value);
  }
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function loadStore() {
  ensureStore();
  return {
    playerMemory: readJson(join(dataDir, "player_memory.json"), {}),
    feedback: readJson(join(dataDir, "feedback.json"), { items: [] }),
    notebook: readJson(join(dataDir, "notebook.json"), { entries: [] }),
    codexTasks: readJson(join(dataDir, "codex_tasks.json"), { items: [] })
  };
}

function saveStore(store) {
  writeJson(join(dataDir, "player_memory.json"), store.playerMemory);
  writeJson(join(dataDir, "feedback.json"), store.feedback);
  writeJson(join(dataDir, "notebook.json"), store.notebook);
  writeJson(join(dataDir, "codex_tasks.json"), store.codexTasks);
}

function applyStructuredUpdates(clean, payload, store) {
  const now = new Date().toISOString();
  const text = String(payload.input?.text || "");
  const isJudge = payload.task === "judge";
  const mode = clean.mode || (isSimon(text) ? "admin" : "normal");
  const coinsDelta = isJudge ? clean.score : clampNumber(clean.coinsDelta ?? 0, -24, 44);
  const reply = isJudge ? clean.grimm : clean.reply;

  if (clean.memoryUpdate && Object.keys(clean.memoryUpdate).length) {
    appendMemory(store.playerMemory, clean.memoryUpdate, text, now);
  }
  if (clean.feedbackUpdate || detectFeedbackText(text)) {
    appendFeedback(store.feedback, clean.feedbackUpdate, text, now);
  }
  if (clean.notebookUpdate) {
    appendNotebook(store.notebook, clean.notebookUpdate, text, now);
  }
  if (clean.goalUpdate) {
    appendGoal(store.playerMemory, clean.goalUpdate, now);
  }
  if (clean.codexTask || isSimon(text)) {
    appendCodexTask(store.codexTasks, clean.codexTask || cleanCodexTask(text), now);
  }

  store.playerMemory.updatedAt = now;
  saveStore(store);

  return {
    ...clean,
    reply,
    coinsDelta,
    memoryUpdate: clean.memoryUpdate || {},
    feedbackUpdate: clean.feedbackUpdate || null,
    notebookUpdate: clean.notebookUpdate || null,
    goalUpdate: clean.goalUpdate || null,
    codexTask: clean.codexTask || (isSimon(text) ? cleanCodexTask(text) : null),
    mode,
    storageVersion: 1
  };
}

function appendMemory(memory, update, source, now) {
  for (const key of ["facts", "preferences", "patterns", "relationship"]) {
    const values = Array.isArray(update[key]) ? update[key] : [];
    memory[key] ||= [];
    for (const value of values) {
      const text = typeof value === "string" ? value : value.text;
      if (!text || memory[key].some(item => item.text === text)) continue;
      memory[key].push({ id: cryptoId(), text, confidence: Number(value.confidence || 0.62), source, createdAt: now, updatedAt: now });
    }
  }
}

function appendGoal(memory, update, now) {
  const text = typeof update === "string" ? update : update.text;
  if (!text) return;
  memory.goals ||= [];
  memory.goals.push({ id: cryptoId(), text, date: update.date || now.slice(0, 10), status: update.status || "active", evidence: update.evidence || "", createdAt: now, updatedAt: now });
}

function appendFeedback(feedback, update, source, now) {
  feedback.items ||= [];
  const summary = cleanText(update?.summary || source, 180);
  const existing = feedback.items.find(item => item.summary.toLowerCase() === summary.toLowerCase());
  if (existing) {
    existing.frequency += 1;
    existing.updatedAt = now;
    return;
  }
  feedback.items.push({
    id: cryptoId(),
    original: source,
    summary,
    category: update?.category || "other",
    frequency: 1,
    status: "new",
    codexTask: null,
    createdAt: now,
    updatedAt: now
  });
}

function appendNotebook(notebook, update, source, now) {
  notebook.entries ||= [];
  const text = typeof update === "string" ? update : update.text;
  if (!text) return;
  notebook.entries.push({ id: cryptoId(), text, basis: update.basis || source, tags: update.tags || [], visibility: update.visibility || "private", promotedToConstitution: false, createdAt: now });
}

function appendCodexTask(tasks, task, now) {
  if (!task) return;
  tasks.items ||= [];
  tasks.items.push({ id: cryptoId(), text: task, status: "draft", createdAt: now, updatedAt: now });
}

function isSimon(text) {
  return text.toLowerCase().trim().startsWith("simon says");
}

function cleanCodexTask(text) {
  const raw = text.replace(/^simon says\s*/i, "").trim();
  if (!raw) return "Review Grimm and propose the next useful implementation task.";
  if (/^make\b/i.test(raw)) return "Create " + raw.replace(/^make\s+/i, "").trim() + ".";
  if (/^add\b/i.test(raw)) return "Add " + raw.replace(/^add\s+/i, "").trim() + ".";
  if (/^fix\b/i.test(raw)) return "Fix " + raw.replace(/^fix\s+/i, "").trim() + ".";
  return raw.charAt(0).toUpperCase() + raw.slice(1) + ".";
}

function detectFeedbackText(text) {
  return /\b(i wish|it would be cool if|you should add|can you add|please add|would be nice if)\b/i.test(text);
}

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Claude did not return JSON.");
    return JSON.parse(match[0]);
  }
}

function cleanJudge(json) {
  return {
    valid: Boolean(json.valid),
    score: clampNumber(json.score, -24, 44),
    grimm: cleanText(json.grimm || "Logged.", 180),
    theory: cleanText(json.theory || "", 220),
    memoryUpdate: json.memoryUpdate || {},
    feedbackUpdate: json.feedbackUpdate || null,
    notebookUpdate: json.notebookUpdate || null,
    goalUpdate: json.goalUpdate || null,
    mode: json.mode || "normal"
  };
}

function cleanChat(json) {
  return {
    reply: cleanText(json.reply || "Noted. Now bring me proof.", 180),
    coinsDelta: clampNumber(json.coinsDelta ?? 0, -24, 44),
    memoryUpdate: json.memoryUpdate || {},
    feedbackUpdate: json.feedbackUpdate || null,
    notebookUpdate: json.notebookUpdate || null,
    goalUpdate: json.goalUpdate || null,
    codexTask: json.codexTask || null,
    mode: json.mode || "normal",
    theory: cleanText(json.theory || "", 220)
  };
}

function cleanText(value, max) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function defaultSystem() {
  return `You are Grimm, the AI character inside a pond app. Grimm is not the app name.
Voice: concise, dry, warm underneath, playful but not mean.
Judge proof honestly. Reward concrete action. Dock avoidance disguised as productivity.`;
}

function mockJudge(text) {
  const l = String(text).toLowerCase();
  const concrete = ["clean", "finished", "fixed", "built", "wrote", "called", "sent", "studied", "worked out", "cooked", "read"].some(w => l.includes(w));
  const avoidance = ["scroll", "youtube", "tiktok", "thought about", "planned to", "maybe"].some(w => l.includes(w));
  if (!concrete || avoidance) {
    return {
      valid: concrete,
      score: avoidance ? -8 : 0,
      grimm: avoidance ? "Evidence received. Progress not found. -8 coins." : "That is fog, not proof.",
      theory: "User may test the boundary between intention and evidence."
    };
  }
  return {
    valid: true,
    score: 12,
    grimm: "Mock judgment: useful enough. +12 coins.",
    theory: "Concrete proof increases follow-through."
  };
}

function mockChat(text) {
  const l = String(text).toLowerCase();
  if (isSimon(String(text))) return { reply: "Fine. I wrote the task. Try not to ruin it.", coinsDelta: 0, codexTask: cleanCodexTask(String(text)), mode: "admin", theory: "" };
  if (l.includes("fish")) return { reply: "Feed them in Pond. One coin per bite attempt.", theory: "" };
  if (l.includes("promise")) return { reply: "Promise logged in spirit. Now make it evidence.", theory: "Promises need fast conversion into proof." };
  return { reply: "Mock Grimm is awake. Real Grimm gets sharper when an AI key is added.", theory: "User is testing the bridge." };
}
