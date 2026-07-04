import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class WorkOrderService {
  constructor(root = process.cwd()) {
    this.dir = join(root, "builder", "work_orders");
  }

  createFromImprovement(decision, ideas = []) {
    if (!decision || decision.type !== "improvement") return null;
    this.ensure();
    const title = titleFrom(decision);
    const suffix = String(decision.ids?.[0] || Math.random().toString(36).slice(2)).slice(0, 8);
    const fileName = `${dateStamp()}-${slug(title)}-${suffix}.md`;
    const path = join(this.dir, fileName);
    const content = renderWorkOrder({ title, decision, ideas });
    writeFileSync(path, content, "utf8");
    return { title, fileName, path };
  }

  ensure() {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }
}

function renderWorkOrder({ title, decision, ideas }) {
  const originals = ideas.map(idea => `- ${idea.originalMessage}`).join("\n") || `- ${decision.summary}`;
  return `# ${title}

## Goal

Build or improve: ${decision.summary}

## Why

Grimm approved this during Work Time because it may strengthen the relationship between Grimm, the pond, and the player.

## Current State

This idea was captured from normal conversation and reviewed in Work Time.

Category: ${decision.category}

Mention count: ${decision.count}

Original mentions:

${originals}

## Desired State

The improvement should feel native to Grimm's pond world and should not turn Grimm into a generic assistant or task manager.

## Acceptance Criteria

- The approved idea is implemented clearly.
- The change preserves the existing three-layer architecture unless the work explicitly requires otherwise.
- The change keeps Grimm relationship-first.
- The app still runs locally and on Vercel.

## Files Likely Affected

- app.js
- index.html
- assets/
- grimm/
- services/

## Notes

This work order is provider-agnostic. Any AI coding assistant can execute it after reading BUILD.md, grimm/constitution.md, and unfinished work orders.

Do not execute this work order automatically.

## Status

approved
`;
}

function titleFrom(decision) {
  const category = String(decision.category || "feature");
  const summary = String(decision.summary || "Approved improvement");
  return `${capitalize(category)}: ${summary}`;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "work-order";
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}
