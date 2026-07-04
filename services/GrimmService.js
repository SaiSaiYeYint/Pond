import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GeminiProvider } from "./providers/GeminiProvider.js";

export class GrimmService {
  constructor({ root = process.cwd(), provider = new GeminiProvider() } = {}) {
    this.root = root;
    this.provider = provider;
  }

  async respond({ message = "", mode = "normal", playerMemory = {}, recentMessages = [], improvementIdea = null, improvementReview = null, improvementDecision = null, lastImprovementDecision = null } = {}) {
    if (!this.provider.configured) return mockResponse(message, mode);
    const text = await this.provider.generate(
      this.buildPrompt({ message, mode, playerMemory, recentMessages, improvementIdea, improvementReview, improvementDecision, lastImprovementDecision }),
      { systemInstruction: this.read("grimm/constitution.md") }
    );
    return cleanResponse(parseJson(text));
  }

  buildPrompt(input) {
    return [
      ...this.promptFiles(input.mode).map(file => this.section(file)),
      this.section("runtime/input.json", JSON.stringify(input, null, 2))
    ].filter(Boolean).join("\n\n");
  }

  promptFiles(mode) {
    return [
      "grimm/personality.md",
      "grimm/rules.md",
      "grimm/examples.md",
      "grimm/operating_manual.md",
      mode === "workshop" ? "grimm/prompts/grimm_workshop.md" : "grimm/prompts/grimm_normal.md"
    ];
  }

  section(file, content = this.read(file)) {
    return content ? `--- ${file} ---\n${content}` : "";
  }

  read(file) {
    try {
      return readFileSync(join(this.root, file), "utf8");
    } catch {
      return "";
    }
  }

  hasFile(file) {
    return Boolean(this.read(file).trim());
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Gemini did not return JSON. Preview: ${String(text).slice(0, 160)}`);
    return JSON.parse(match[0]);
  }
}

function cleanResponse(json) {
  const mode = json.mode === "workshop" ? "workshop" : json.mode === "normal" ? "normal" : undefined;
  return {
    reply: cleanText(json.reply || "Noted. Now bring me proof.", mode === "workshop" ? 1200 : 260),
    memoryUpdate: json.memoryUpdate && typeof json.memoryUpdate === "object" ? json.memoryUpdate : {},
    coinsDelta: clamp(json.coinsDelta, -24, 44),
    mode,
    suggestedActions: Array.isArray(json.suggestedActions) ? json.suggestedActions.map(x => cleanText(x, 120)).slice(0, 5) : []
  };
}

function mockResponse(message, mode) {
  const simon = String(message).toLowerCase().trim().startsWith("simon says");
  return {
    reply: simon || mode === "workshop"
      ? "Workshop brain is wired. Add GEMINI_API_KEY and I will stop pretending."
      : "Gemini is not connected yet. I am using the cheap pond echo. Bring proof anyway.",
    memoryUpdate: {},
    coinsDelta: 0,
    suggestedActions: []
  };
}

function cleanText(value, max) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, Math.round(n)));
}
