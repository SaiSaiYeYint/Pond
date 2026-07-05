import { readFileSync } from "node:fs";
import { join } from "node:path";

export class PromptService {
  constructor(root = process.cwd()) {
    this.root = root;
  }

  build(input = {}) {
    return {
      systemInstruction: this.coreFiles().map(file => this.section(file)).filter(Boolean).join("\n\n"),
      userPrompt: [
        ...this.promptFiles(input.mode).map(file => this.section(file)),
        this.section("runtime/memory-summary.json", JSON.stringify(this.memorySummary(input.playerMemory), null, 2)),
        input.reflectionSummary ? this.section("runtime/private-reflection-summary.json", JSON.stringify(input.reflectionSummary, null, 2)) : "",
        this.section("runtime/recent-messages.json", JSON.stringify(input.recentMessages || [], null, 2)),
        this.section("runtime/input.json", JSON.stringify(input, null, 2)),
        this.section("runtime/response-schema.json", JSON.stringify(responseSchema(), null, 2))
      ].filter(Boolean).join("\n\n")
    };
  }

  promptFiles(mode = "normal") {
    return [
      "grimm/rules.md",
      "grimm/operating_manual.md",
      mode === "workshop" ? "grimm/prompts/grimm_workshop.md" : "grimm/prompts/grimm_normal.md"
    ];
  }

  coreFiles() {
    return [
      "grimm/identity.md",
      "grimm/mission.md",
      "grimm/voice.md",
      "grimm/constitution.md",
      "grimm/examples.md"
    ];
  }

  section(file, content = this.read(file)) {
    return content ? `--- ${file} ---\n${content}` : "";
  }

  hasFile(file) {
    return Boolean(this.read(file).trim());
  }

  read(file) {
    try {
      return readFileSync(join(this.root, file), "utf8");
    } catch {
      return "";
    }
  }

  memorySummary(memory = {}) {
    return {
      facts: Array.isArray(memory.facts) ? memory.facts.slice(-12) : [],
      preferences: Array.isArray(memory.preferences) ? memory.preferences.slice(-12) : [],
      patterns: Array.isArray(memory.patterns) ? memory.patterns.slice(-12) : [],
      goals: Array.isArray(memory.goals) ? memory.goals.slice(-8) : [],
      relationship: Array.isArray(memory.relationship) ? memory.relationship.slice(-12) : [],
      clientContext: memory.clientContext || {}
    };
  }
}

function responseSchema() {
  return {
    type: "object",
    required: ["reply", "coinsDelta", "memoryUpdate", "shouldLog", "improvement", "workOrder"],
    properties: {
      reply: { type: "string" },
      coinsDelta: { type: "number" },
      memoryUpdate: { type: "object" },
      shouldLog: { type: "boolean" },
      improvement: { anyOf: [{ type: "object" }, { type: "null" }] },
      workOrder: { anyOf: [{ type: "object" }, { type: "null" }] },
      mode: { enum: ["normal", "workshop", null] },
      suggestedActions: { type: "array", items: { type: "string" } }
    }
  };
}
