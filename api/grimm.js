import { GrimmService } from "../services/GrimmService.js";
import { MemoryService } from "../services/MemoryService.js";

const grimmService = new GrimmService();
const memoryService = new MemoryService();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const input = normalize(req.body || {});
    const storedMemory = memoryService.load();
    const response = await grimmService.respond({
      ...input,
      playerMemory: { ...storedMemory, ...input.playerMemory }
    });
    const nextMemory = memoryService.applyUpdate(storedMemory, response.memoryUpdate, input.message);
    memoryService.save(nextMemory);
    return res.status(200).json(response);
  } catch (error) {
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
