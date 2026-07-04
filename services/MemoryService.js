import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export class MemoryService {
  constructor(root = process.cwd()) {
    this.dataDir = process.env.VERCEL ? join(tmpdir(), "grimm-data") : join(root, "data");
  }

  load() {
    this.ensure();
    return this.read("player_memory.json", defaultMemory());
  }

  save(memory) {
    this.ensure();
    this.write("player_memory.json", { ...memory, updatedAt: new Date().toISOString() });
  }

  forRequest(clientMemory = {}) {
    return this.merge(this.load(), clientMemory);
  }

  saveUpdate(update = {}, source = "") {
    const next = this.applyUpdate(this.load(), update, source);
    this.save(next);
    return next;
  }

  merge(storedMemory = {}, clientMemory = {}) {
    const next = { ...defaultMemory(), ...storedMemory };
    if (clientMemory && typeof clientMemory === "object") {
      next.clientContext = {
        profile: clientMemory.profile || {},
        theories: Array.isArray(clientMemory.theories) ? clientMemory.theories.slice(-8) : [],
        recentEvidence: Array.isArray(clientMemory.recentEvidence) ? clientMemory.recentEvidence.slice(-20) : []
      };
    }
    return next;
  }

  applyUpdate(memory, update = {}, source = "") {
    const next = { ...defaultMemory(), ...memory };
    for (const key of ["facts", "preferences", "patterns", "goals", "relationship"]) {
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
