import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export class ReflectionService {
  constructor(root = process.cwd()) {
    this.dataDir = process.env.VERCEL ? join(tmpdir(), "grimm-data") : join(root, "data");
    this.fileName = "reflections.json";
  }

  reflect({ message = "", reply = "", recentMessages = [], mode = "normal", memoryUpdate = {}, improvementIdea = null } = {}) {
    const transcript = this.transcript({ message, reply, recentMessages });
    if (!transcript.length) return null;
    const entry = {
      id: cryptoId(),
      mode,
      summary: summarizeConversation(transcript),
      recurringPatterns: detectPatterns(transcript),
      possibleMemoryUpdates: suggestMemoryUpdates(transcript, memoryUpdate),
      improvementIdeas: detectImprovementIdeas(transcript, improvementIdea),
      burmeseMisunderstandings: detectBurmeseMisunderstandings(transcript),
      sourceMessage: String(message).trim(),
      createdAt: new Date().toISOString()
    };
    this.append(entry);
    return entry;
  }

  load() {
    this.ensure();
    try {
      const value = JSON.parse(readFileSync(join(this.dataDir, this.fileName), "utf8"));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  summaryForPrompt({ mode = "normal", limit = 6 } = {}) {
    const entries = this.load()
      .filter(entry => !mode || entry.mode === mode || entry.mode === "normal")
      .slice(-limit);
    if (!entries.length) return null;
    return {
      note: "Internal Grimm reflection context. Use quietly. Do not reveal this source to the player.",
      summaries: entries.map(entry => ({
        summary: entry.summary,
        recurringPatterns: entry.recurringPatterns || [],
        possibleMemoryUpdates: entry.possibleMemoryUpdates || [],
        improvementIdeas: entry.improvementIdeas || [],
        burmeseMisunderstandings: entry.burmeseMisunderstandings || [],
        createdAt: entry.createdAt
      }))
    };
  }

  append(entry) {
    const entries = this.load();
    entries.push(entry);
    this.save(entries.slice(-500));
  }

  save(entries) {
    this.ensure();
    writeFileSync(join(this.dataDir, this.fileName), JSON.stringify(entries, null, 2) + "\n", "utf8");
  }

  ensure() {
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true });
    const path = join(this.dataDir, this.fileName);
    if (!existsSync(path)) writeFileSync(path, "[]\n", "utf8");
  }

  transcript({ message, reply, recentMessages }) {
    const recent = Array.isArray(recentMessages) ? recentMessages.slice(-12) : [];
    return [
      ...recent.map(item => `${item.role || "unknown"}: ${item.text || ""}`),
      `player: ${message}`,
      `grimm: ${reply}`
    ].map(line => line.replace(/\s+/g, " ").trim()).filter(line => line.length > 8);
  }
}

function summarizeConversation(lines) {
  const lastPlayer = [...lines].reverse().find(line => line.startsWith("player:")) || lines.at(-1) || "";
  return clean(lastPlayer.replace(/^player:\s*/i, ""), 220);
}

function detectPatterns(lines) {
  const text = lines.join(" ").toLowerCase();
  const patterns = [];
  if (/\b(again|always|keep|still|every time|usually)\b/.test(text)) patterns.push("Possible repeated behavior or recurring concern.");
  if (/\b(tired|late|avoid|avoiding|stuck|forgot|failed)\b/.test(text)) patterns.push("Possible friction or avoidance pattern.");
  if (/\b(clean|study|walk|run|write|build|ship|finish|finished|practice)\b/.test(text)) patterns.push("Possible concrete action pattern.");
  return patterns;
}

function suggestMemoryUpdates(lines, memoryUpdate) {
  const suggestions = [];
  if (memoryUpdate && typeof memoryUpdate === "object" && Object.keys(memoryUpdate).length) {
    suggestions.push({ type: "ai_suggested", value: memoryUpdate });
  }
  const text = lines.join(" ");
  const preference = text.match(/\b(i like|i love|i prefer|i hate|i don't like)\s+([^.!?]{3,80})/i);
  if (preference) suggestions.push({ type: "preference_candidate", text: clean(preference[0], 140) });
  return suggestions;
}

function detectImprovementIdeas(lines, improvementIdea) {
  const ideas = [];
  if (improvementIdea) ideas.push(improvementIdea);
  for (const line of lines) {
    if (/\b(i wish|should add|should be|need\s+\w+|it would be cool|feature|bug|fix)\b/i.test(line)) {
      ideas.push({ text: clean(line.replace(/^player:\s*/i, ""), 180) });
    }
  }
  return ideas;
}

function detectBurmeseMisunderstandings(lines) {
  const text = lines.join(" ");
  const mentionsBurmese = /\b(burmese|myanmar|မြန်မာ|ဗမာ)\b/i.test(text);
  if (!mentionsBurmese) return [];
  const confusion = /\b(confused|wrong|misunderstand|translate|meaning|pronounce|grammar|don't understand|not understand)\b/i.test(text);
  return confusion ? [{ text: "Possible Burmese learning misunderstanding for future review." }] : [];
}

function clean(value, max) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
}
