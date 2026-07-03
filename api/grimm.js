import { readFileSync } from "node:fs";
import { join } from "node:path";

const model = process.env.OPENAI_MODEL || process.env.CLAUDE_MODEL || "gpt-4.1-mini";
const openaiKey = process.env.OPENAI_API_KEY;
const claudeKey = process.env.ANTHROPIC_API_KEY;
const mockWithoutKey = process.env.MOCK_GRIMM_WITHOUT_KEY !== "false";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const payload = normalizePayload(req.body || {});
    if (!openaiKey && !claudeKey && mockWithoutKey) {
      const clean = payload.task === "judge" ? mockJudge(payload.input?.text || "") : mockChat(payload.input?.text || "");
      return res.status(200).json(structured(clean, payload));
    }
    if (!openaiKey && !claudeKey) {
      return res.status(503).json({ error: "missing_api_key", message: "Add OPENAI_API_KEY or ANTHROPIC_API_KEY." });
    }

    const text = openaiKey ? await callOpenAI(payload) : await callClaude(payload);
    const json = parseJson(text);
    const clean = payload.task === "judge" ? cleanJudge(json) : cleanChat(json);
    return res.status(200).json(structured(clean, payload));
  } catch (error) {
    return res.status(500).json({
      error: "grimm_failed",
      message: error instanceof Error ? error.message : "Unknown server error"
    });
  }
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

async function callClaude(payload) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 260,
      temperature: 0.85,
      system: payload.system,
      messages: [{ role: "user", content: buildPrompt(payload) }]
    })
  });
  if (!response.ok) throw new Error(`Claude failed: ${response.status}`);
  const data = await response.json();
  return (data.content || []).filter(part => part.type === "text").map(part => part.text).join("\n").trim();
}

function normalizePayload(body) {
  return {
    task: body?.task === "chat" ? "chat" : "judge",
    input: body?.input || {},
    system: String(body?.system || defaultSystem()),
    caseStudy: body?.caseStudy || {},
    responseContract: body?.responseContract || {}
  };
}

function buildPrompt(payload) {
  const contract = payload.task === "judge"
    ? `Return JSON only: {"valid": boolean, "score": number, "grimm": string, "theory": string, "memoryUpdate": object, "feedbackUpdate": object|null, "notebookUpdate": object|null, "goalUpdate": object|null}`
    : `Return JSON only: {"reply": string, "coinsDelta": number, "memoryUpdate": object, "feedbackUpdate": object|null, "notebookUpdate": object|null, "goalUpdate": object|null, "codexTask": string|null, "mode": "normal"|"admin"|"workshop", "theory": string}`;
  return [
    `Task: ${payload.task}`,
    "",
    "Grimm source-of-truth files:",
    loadBrain(),
    "",
    contract,
    "",
    "User input:",
    JSON.stringify(payload.input, null, 2),
    "",
    "Local browser case study:",
    JSON.stringify(payload.caseStudy, null, 2),
    "",
    "Persistent database is not configured in this Vercel function yet. Return structured updates for the browser to store locally.",
    "Do not include markdown. Do not wrap JSON in code fences."
  ].join("\n");
}

function loadBrain() {
  return [
    "grimm/constitution.md",
    "grimm/operating_manual.md",
    "grimm/prompts/grimm_normal.md",
    "grimm/prompts/grimm_workshop.md",
    "grimm/prompts/grimm_memory_update.md"
  ].map(file => {
    try {
      return `--- ${file} ---\n` + readFileSync(join(process.cwd(), file), "utf8");
    } catch {
      return `--- ${file} missing ---`;
    }
  }).join("\n\n");
}

function structured(clean, payload) {
  const text = String(payload.input?.text || "");
  const isJudge = payload.task === "judge";
  const mode = clean.mode || (isSimon(text) ? "admin" : "normal");
  return {
    ...clean,
    reply: isJudge ? clean.grimm : clean.reply,
    coinsDelta: isJudge ? clean.score : clampNumber(clean.coinsDelta ?? 0, -24, 44),
    memoryUpdate: clean.memoryUpdate || {},
    feedbackUpdate: clean.feedbackUpdate || null,
    notebookUpdate: clean.notebookUpdate || null,
    goalUpdate: clean.goalUpdate || null,
    codexTask: clean.codexTask || (isSimon(text) ? cleanCodexTask(text) : null),
    mode,
    storageVersion: 1
  };
}

function isSimon(text) {
  return String(text).toLowerCase().trim().startsWith("simon says");
}

function cleanCodexTask(text) {
  const raw = String(text).replace(/^simon says\s*/i, "").trim();
  if (!raw) return "Review Grimm and propose the next useful implementation task.";
  if (/^make\b/i.test(raw)) return "Create " + raw.replace(/^make\s+/i, "").trim() + ".";
  if (/^add\b/i.test(raw)) return "Add " + raw.replace(/^add\s+/i, "").trim() + ".";
  if (/^fix\b/i.test(raw)) return "Fix " + raw.replace(/^fix\s+/i, "").trim() + ".";
  return raw.charAt(0).toUpperCase() + raw.slice(1) + ".";
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI did not return JSON.");
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
  return { valid: true, score: 12, grimm: "Mock judgment: useful enough. +12 coins.", theory: "Concrete proof increases follow-through." };
}

function mockChat(text) {
  if (isSimon(text)) return { reply: "Fine. I wrote the task. Try not to ruin it.", coinsDelta: 0, codexTask: cleanCodexTask(text), mode: "admin", theory: "" };
  return { reply: "Mock Grimm is awake. Real Grimm gets sharper when an AI key is added.", coinsDelta: 0, theory: "User is testing the bridge." };
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
  return "You are Grimm, the AI character beneath the pond. Be concise, dry, warm underneath, and judge proof honestly.";
}
