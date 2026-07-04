import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class MemoryService {
  constructor(root = process.cwd()) {
    this.dataDir = join(root, "data");
  }

  load() {
    this.ensure();
    return this.read("player_memory.json", defaultMemory());
  }

  save(memory) {
    this.ensure();
    this.write("player_memory.json", { ...memory, updatedAt: new Date().toISOString() });
  }

  applyUpdate(memory, update = {}, source = "") {
    const next = { ...defaultMemory(), ...memory };
    for (const key of ["facts", "preferences", "patterns", "relationship"]) {
      next[key] ||= [];
      const values = Array.isArray(update[key]) ? update[key] : [];
      for (const value of values) {
        const text = typeof value === "string" ? value : value?.text;
        if (!text || next[key].some(item => item.text === text)) continue;
        next[key].push({
          id: cryptoId(),
          text,
          confidence: Number(value.confidence || 0.62),
          source,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
    return next;
  }

  ensure() {
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true });
    const path = join(this.dataDir, "player_memory.json");
    if (!existsSync(path)) this.write("player_memory.json", defaultMemory());
  }

  read(name, fallback) {
    try {
      return JSON.parse(readFileSync(join(this.dataDir, name), "utf8"));
    } catch {
      return fallback;
    }
  }

  write(name, value) {
    writeFileSync(join(this.dataDir, name), JSON.stringify(value, null, 2) + "\n", "utf8");
  }
}

function defaultMemory() {
  return {
    playerId: "local-player",
    version: 1,
    facts: [],
    preferences: [],
    patterns: [],
    goals: [],
    relationship: [],
    updatedAt: new Date().toISOString()
  };
}

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
}
