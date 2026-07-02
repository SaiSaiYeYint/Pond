import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const port = Number(process.env.PORT || 8787);
const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
const apiKey = process.env.ANTHROPIC_API_KEY;
const mockWithoutKey = process.env.MOCK_GRIMM_WITHOUT_KEY !== "false";
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

app.use(cors({ origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/] }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, model, hasApiKey: Boolean(apiKey), mode: apiKey ? "claude" : mockWithoutKey ? "mock" : "missing-key" });
});

app.post("/grimm", async (req, res) => {
  try {
    if (!anthropic && mockWithoutKey) {
      const payload = normalizePayload(req.body);
      return res.json(payload.task === "judge" ? mockJudge(payload.input?.text || "") : mockChat(payload.input?.text || ""));
    }

    if (!anthropic) {
      return res.status(503).json({
        error: "missing_api_key",
        message: "Add ANTHROPIC_API_KEY to .env and restart the server."
      });
    }

    const payload = normalizePayload(req.body);
    const response = await anthropic.messages.create({
      model,
      max_tokens: 260,
      temperature: 0.85,
      system: payload.system,
      messages: [
        {
          role: "user",
          content: buildPrompt(payload)
        }
      ]
    });

    const text = response.content
      .filter(part => part.type === "text")
      .map(part => part.text)
      .join("\n")
      .trim();

    const json = parseJson(text);
    const clean = payload.task === "judge" ? cleanJudge(json) : cleanChat(json);
    res.json(clean);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "grimm_failed",
      message: error instanceof Error ? error.message : "Unknown server error"
    });
  }
});

app.listen(port, () => {
  console.log(`Grimm Claude bridge listening on http://127.0.0.1:${port}`);
});

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
  const contract = payload.task === "judge"
    ? `Return JSON only with this shape:
{"valid": boolean, "score": number, "grimm": string, "theory": string}

Scoring:
- valid false for chat, vague text, future plans, or fake productivity.
- score must be between -24 and 44.
- grimm must be short, in Grimm's voice, no generic praise.
- theory is hidden case-file learning, not shown directly to user.`
    : `Return JSON only with this shape:
{"reply": string, "theory": string}

Rules:
- reply must be short, in Grimm's voice.
- theory is optional hidden case-file learning.`;

  return [
    `Task: ${payload.task}`,
    "",
    contract,
    "",
    "User input:",
    JSON.stringify(payload.input, null, 2),
    "",
    "Hidden case study:",
    JSON.stringify(payload.caseStudy, null, 2),
    "",
    "Do not include markdown. Do not wrap JSON in code fences."
  ].join("\n");
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
    theory: cleanText(json.theory || "", 220)
  };
}

function cleanChat(json) {
  return {
    reply: cleanText(json.reply || "Noted. Now bring me proof.", 180),
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
  if (l.includes("fish")) return { reply: "Feed them in Pond. One coin per bite attempt.", theory: "" };
  if (l.includes("promise")) return { reply: "Promise logged in spirit. Now make it evidence.", theory: "Promises need fast conversion into proof." };
  return { reply: "Mock Grimm is awake. Real Grimm arrives when Claude gets a key.", theory: "User is testing the bridge." };
}
