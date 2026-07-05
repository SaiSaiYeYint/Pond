export class ResponseValidator {
  validate(raw, { mode = "normal" } = {}) {
    try {
      return this.clean(parseJson(raw), mode);
    } catch {
      return this.fallback({ mode });
    }
  }

  clean(json = {}, mode = "normal") {
    const cleanMode = json.mode === "workshop" ? "workshop" : json.mode === "normal" ? "normal" : undefined;
    const activeMode = cleanMode || mode;
    return {
      reply: cleanText(json.reply || "I heard static under the pond. Say it again.", activeMode === "workshop" ? 1200 : 260),
      coinsDelta: clamp(json.coinsDelta, -24, 44),
      memoryUpdate: json.memoryUpdate && typeof json.memoryUpdate === "object" ? json.memoryUpdate : {},
      shouldLog: Boolean(json.shouldLog),
      improvement: json.improvement && typeof json.improvement === "object" ? json.improvement : null,
      workOrder: json.workOrder && typeof json.workOrder === "object" ? json.workOrder : null,
      mode: cleanMode,
      suggestedActions: Array.isArray(json.suggestedActions) ? json.suggestedActions.map(item => cleanText(item, 120)).slice(0, 5) : []
    };
  }

  fallback({ mode = "normal" } = {}) {
    return {
      reply: mode === "workshop"
        ? "The workshop brain coughed up nonsense. Annoying. Try the question again."
        : "My thoughts came back crooked. Try that again.",
      coinsDelta: 0,
      memoryUpdate: {},
      shouldLog: false,
      improvement: null,
      workOrder: null,
      mode,
      suggestedActions: []
    };
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found.");
    return JSON.parse(match[0]);
  }
}

function cleanText(value, max) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, Math.round(n)));
}
