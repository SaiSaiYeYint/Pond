import { GrimmRuntime } from "../services/GrimmRuntime.js";
import { MemoryService } from "../services/MemoryService.js";
import { ImprovementService } from "../services/ImprovementService.js";
import { WorkOrderService } from "../services/WorkOrderService.js";

const memoryService = new MemoryService();
const improvementService = new ImprovementService();
const grimmRuntime = new GrimmRuntime({ memoryService, improvementService });
const workOrderService = new WorkOrderService();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") {
    await grimmRuntime.providerService.startupCheck;
    return res.status(200).json({
      ok: true,
      route: "/api/grimm",
      provider: "gemini",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      ...grimmRuntime.health("normal")
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const input = normalize(req.body || {});
    if (isReflectCommand(input.message)) {
      return res.status(200).json(grimmRuntime.reflect(input));
    }
    const workTimeCommand = isWorkTimeCommand(input.message);
    const decisionResult = applyImprovementDecision(input);
    const improvementIdea = improvementService.capture(input.message, input.mode);
    const improvementReview = workTimeCommand ? improvementService.review() : null;
    const improvementDecision = workTimeCommand || decisionResult ? improvementService.nextDecision() : null;
    const response = await grimmRuntime.respond({
      ...input,
      mode: workTimeCommand ? "workshop" : input.mode,
      improvementIdea,
      improvementReview,
      improvementDecision,
      lastImprovementDecision: decisionResult
    });
    if (improvementDecision) response.decision = improvementDecision;
    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "grimm_failed",
      message: error instanceof Error ? error.message : "Unknown server error"
    });
  }
}

function normalize(body) {
  return {
    message: String(body.message || body.input?.text || ""),
    mode: String(body.mode || "normal"),
    playerMemory: body.playerMemory || {},
    recentMessages: Array.isArray(body.recentMessages) ? body.recentMessages.slice(-12) : []
  };
}

function isWorkTimeCommand(message) {
  return String(message).toLowerCase().trim() === "simon says work time";
}

function isReflectCommand(message) {
  return String(message).toLowerCase().trim() === "simon says reflect";
}

function applyImprovementDecision(input) {
  if (input.mode !== "workshop" || input.decision?.type !== "improvement") return null;
  const answer = String(input.message).toLowerCase().trim();
  if (answer !== "yes" && answer !== "no") return null;
  const result = improvementService.setStatus(input.decision.ids, answer === "yes" ? "approved" : "rejected");
  if (answer === "yes" && result?.changed) result.workOrder = workOrderService.createFromImprovement(input.decision, result.ideas);
  return result;
}
