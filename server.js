import "dotenv/config";
import express from "express";
import cors from "cors";
import { GrimmService } from "./services/GrimmService.js";
import { MemoryService } from "./services/MemoryService.js";

const app = express();
const port = Number(process.env.PORT || 8787);
const grimmService = new GrimmService();
const memoryService = new MemoryService();

app.use(cors({
  origin(origin, done) {
    if (!origin || origin === "null" || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return done(null, true);
    return done(null, false);
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(process.cwd()));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    mode: process.env.GEMINI_API_KEY ? "gemini" : "mock"
  });
});

app.get("/grimm/state", (_req, res) => {
  res.json({ playerMemory: memoryService.load() });
});

app.post("/grimm", async (req, res) => {
  try {
    const input = normalize(req.body || {});
    const storedMemory = memoryService.load();
    const response = await grimmService.respond({
      ...input,
      playerMemory: { ...storedMemory, ...input.playerMemory }
    });
    const nextMemory = memoryService.applyUpdate(storedMemory, response.memoryUpdate, input.message);
    memoryService.save(nextMemory);
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "grimm_failed",
      message: error instanceof Error ? error.message : "Unknown server error"
    });
  }
});

app.listen(port, () => {
  console.log(`Grimm bridge listening on http://127.0.0.1:${port}`);
});

function normalize(body) {
  return {
    message: String(body.message || body.input?.text || ""),
    mode: String(body.mode || "normal"),
    playerMemory: body.playerMemory || {},
    recentMessages: Array.isArray(body.recentMessages) ? body.recentMessages.slice(-12) : []
  };
}
