import { GrimmRuntime } from "../services/GrimmRuntime.js";
import { PromptService } from "../services/PromptService.js";
import { ProviderService } from "../services/ProviderService.js";
import { ResponseValidator } from "../services/ResponseValidator.js";

const promptService = new PromptService();
const responseValidator = new ResponseValidator();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") {
    const providerName = normalizeProvider(req.query?.provider);
    const providerService = new ProviderService({ providerName });
    return res.status(200).json({ status: await providerStatus(providerService) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const body = req.body || {};
  const providerName = normalizeProvider(body.provider);
  const providerService = new ProviderService({ providerName });
  const runtime = new GrimmRuntime({ promptService, providerService, responseValidator });
  const input = runtime.prepareInput({
    message: String(body.userMessage || ""),
    mode: "normal",
    playerMemory: {},
    recentMessages: []
  });
  const prompt = promptService.build(input);
  const systemInstruction = String(body.systemPrompt || "").trim() || prompt.systemInstruction;

  try {
    await providerService.ensureAvailable();
    const rawProviderResponse = await providerService.generate({
      systemInstruction,
      userPrompt: prompt.userPrompt
    });
    const validatedResponse = responseValidator.validate(rawProviderResponse, { mode: "normal" });
    return res.status(200).json({
      provider: providerName,
      status: await providerStatus(providerService),
      rawProviderResponse,
      validatedResponse,
      finalGrimmReply: validatedResponse.reply,
      error: null
    });
  } catch (error) {
    return res.status(200).json({
      provider: providerName,
      status: await providerStatus(providerService),
      rawProviderResponse: "",
      validatedResponse: null,
      finalGrimmReply: providerName === "ollama" ? "Grimm is asleep. Start Ollama to wake him." : "",
      error: error instanceof Error ? error.message : "Unknown lab error."
    });
  }
}

function normalizeProvider(value) {
  const provider = String(value || "ollama").toLowerCase();
  return provider === "gemini" ? "gemini" : "ollama";
}

async function providerStatus(providerService) {
  await providerService.startupCheck;
  const health = providerService.health();
  return {
    activeProvider: health.provider,
    model: health.model,
    health: health.available ? "awake" : "asleep",
    configured: health.configured,
    checked: health.checked
  };
}
