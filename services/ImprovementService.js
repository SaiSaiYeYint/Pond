import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export class ImprovementService {
  constructor(root = process.cwd()) {
    this.dataDir = process.env.VERCEL ? join(tmpdir(), "grimm-data") : join(root, "data");
    this.fileName = "improvements.json";
  }

  capture(message = "", mode = "normal") {
    if (mode !== "normal" || !this.isImprovement(message)) return null;
    const ideas = this.load();
    const idea = {
      id: cryptoId(),
      originalMessage: String(message).trim(),
      summary: summarize(message),
      category: categorize(message),
      status: "new",
      createdAt: new Date().toISOString()
    };
    ideas.push(idea);
    this.save(ideas);
    return { ...idea, shouldAcknowledge: shouldAcknowledge(message, ideas.length) };
  }

  review() {
    const ideas = this.load().filter(idea => idea.status === "new");
    const grouped = groupBy(ideas, idea => idea.category || "feature");
    const duplicates = findDuplicates(ideas);
    return {
      newIdeas: ideas,
      groupedIdeas: grouped,
      duplicates,
      priorities: prioritize(grouped, duplicates)
    };
  }

  nextDecision() {
    const ideas = this.load().filter(idea => idea.status === "new");
    if (!ideas.length) return null;
    const groups = groupBy(ideas, idea => ideaKey(idea));
    const group = Object.values(groups).sort((a, b) => b.length - a.length)[0];
    const first = group[0];
    return {
      type: "improvement",
      ids: group.map(idea => idea.id),
      summary: first.summary,
      category: first.category,
      count: group.length
    };
  }

  setStatus(ids = [], status = "new") {
    const allowed = new Set(["new", "approved", "rejected"]);
    if (!allowed.has(status) || !Array.isArray(ids) || !ids.length) return null;
    const idSet = new Set(ids);
    const ideas = this.load();
    let changed = 0;
    const changedIdeas = [];
    for (const idea of ideas) {
      if (!idSet.has(idea.id)) continue;
      idea.status = status;
      idea.updatedAt = new Date().toISOString();
      changed += 1;
      changedIdeas.push({ ...idea });
    }
    this.save(ideas);
    return { status, changed, ideas: changedIdeas };
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

  save(ideas) {
    this.ensure();
    writeFileSync(join(this.dataDir, this.fileName), JSON.stringify(ideas, null, 2) + "\n", "utf8");
  }

  ensure() {
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true });
    const path = join(this.dataDir, this.fileName);
    if (!existsSync(path)) writeFileSync(path, "[]\n", "utf8");
  }

  isImprovement(message) {
    const text = String(message).toLowerCase();
    if (/\bneed\s+(fish|orb|chat|bubble|pond|coin|trophy|goal|feature|page|shop|breeding|inventory)\b/.test(text)) return true;
    if (/\b(grimm|orb|fish|pond|chat|bubble|ui|design)\s+should\b/.test(text)) return true;
    return [
      "i wish",
      "i think grimm should",
      "grimm should",
      "it would be cool",
      "you should",
      "can you add",
      "could you add",
      "please add",
      "add a",
      "add an",
      "make it",
      "make the",
      "fix the",
      "this feels weird",
      "this is buggy",
      "bug",
      "feature"
    ].some(phrase => text.includes(phrase));
  }
}

function summarize(message) {
  return String(message).replace(/\s+/g, " ").trim().slice(0, 160);
}

function categorize(message) {
  const text = String(message).toLowerCase();
  if (/\b(grimm|personality|joke|roast|voice|tone|funny|talk|reply)\b/.test(text)) return "personality";
  if (/\b(orb|ui|design|visual|layout|button|screen|bubble|color|bigger|smaller|animation)\b/.test(text)) return "design";
  if (/\b(fish|pond|water|feed|koi|breeding|shop|inventory|coin|trophy|goal|reward|week|page)\b/.test(text)) return "feature";
  if (/\b(bug|fix|broken|weird)\b/.test(text)) return "bug";
  return "feature";
}

function shouldAcknowledge(message, count) {
  const seed = [...String(message)].reduce((n, ch) => n + ch.charCodeAt(0), count);
  return seed % 3 === 0;
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] ||= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function findDuplicates(ideas) {
  const bySummary = groupBy(ideas, idea => ideaKey(idea));
  return Object.values(bySummary)
    .filter(group => group.length > 1)
    .map(group => ({
      summary: group[0].summary,
      count: group.length,
      ids: group.map(idea => idea.id)
    }));
}

function prioritize(grouped, duplicates) {
  return Object.entries(grouped)
    .map(([category, ideas]) => ({
      category,
      count: ideas.length,
      duplicateCount: duplicates.filter(dup => ideas.some(idea => dup.ids.includes(idea.id))).length,
      priority: ideas.length >= 3 ? "high" : ideas.length === 2 ? "medium" : "low"
    }))
    .sort((a, b) => b.count - a.count);
}

function normalizeIdea(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function ideaKey(idea) {
  return `${idea.category || "feature"}:${normalizeIdea(idea.summary)}`;
}

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
}
