import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GeminiProvider } from "./providers/GeminiProvider.js";

export class GrimmService {
  constructor({ root = process.cwd(), provider = new GeminiProvider() } = {}) {
    this.root = root;
    this.provider = provider;
  }

  async respond({ message = "", mode = "normal", playerMemory = {}, recentMessages = [] } = {}) {
    if (!this.provider.configured) return mockResponse(message, mode);
    const text = await this.provider.generate(this.prompt({ message, mode, playerMemory, recentMessages }));
    return cleanResponse(parseJson(text));
  }

  prompt(input) {
    const workshopPrompt = input.mode === "workshop" ? this.read("grimm/prompts/grimm_workshop.md") : "";
    return [
      "You are running Grimm through GrimmService. The model is not the source of truth.",
      "Read the Constitution and return structured output only.",
      "",
      "--- grimm/constitution.md ---",
      this.read("grimm/constitution.md"),
      "",
      "--- grimm/operating_manual.md ---",
      this.read("grimm/operating_manual.md"),
      "",
      "--- active prompt ---",
      workshopPrompt || this.read("grimm/prompts/grimm_normal.md"),
      "",
      "Output JSON only with this exact shape:",
      JSON.stringify({
        reply: "short Grimm reply",
        memoryUpdate: {},
        coinsDelta: 0,
        suggestedActions: []
      }, null, 2),
      "",
      "Rules:",
      "- Return a single raw JSON object. No markdown. No commentary. No code fence.",
      "- reply must sound like Grimm, not a generic assistant.",
      "- coinsDelta must be an integer from -24 to 44.",
      "- suggestedActions is an array of short strings.",
      "- normal mode is for player conversation.",
      "- workshop mode is private owner/development mode. Prepare for it, but do not expose private notes in normal mode.",
      "",
      "Input:",
      JSON.stringify(input, null, 2)
    ].join("\n");
  }

  read(file) {
    try {
      return readFileSync(join(this.root, file), "utf8");
    } catch {
      return "";
    }
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
  return {
    reply: cleanText(json.reply || "Noted. Now bring me proof.", 260),
    memoryUpdate: json.memoryUpdate && typeof json.memoryUpdate === "object" ? json.memoryUpdate : {},
    coinsDelta: clamp(json.coinsDelta, -24, 44),
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
