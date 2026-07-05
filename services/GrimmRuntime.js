import { MemoryService } from "./MemoryService.js";
import { PromptService } from "./PromptService.js";
import { ProviderService } from "./ProviderService.js";
import { ResponseValidator } from "./ResponseValidator.js";
import { ReflectionService } from "./ReflectionService.js";
import { ImprovementService } from "./ImprovementService.js";

export class GrimmRuntime {
  constructor({
    memoryService = new MemoryService(),
    promptService = new PromptService(),
    providerService = new ProviderService(),
    responseValidator = new ResponseValidator(),
    reflectionService = new ReflectionService(),
    improvementService = new ImprovementService()
  } = {}) {
    this.memoryService = memoryService;
    this.promptService = promptService;
    this.providerService = providerService;
    this.responseValidator = responseValidator;
    this.reflectionService = reflectionService;
    this.improvementService = improvementService;
  }

  async respond(input = {}) {
    const runtimeInput = this.prepareInput(input);
    runtimeInput.reflectionSummary = this.reflectionService.summaryForPrompt({ mode: runtimeInput.mode });
    const prompt = this.promptService.build(runtimeInput);
    if (!this.providerService.providerConfigured) return this.responseValidator.fallback({ mode: runtimeInput.mode });
    try {
      await this.providerService.ensureAvailable();
    } catch {
      return this.providerUnavailable(runtimeInput.mode);
    }
    let raw;
    try {
      raw = await this.providerService.generate(prompt);
    } catch (error) {
      if (this.providerService.providerName === "ollama") return this.providerUnavailable(runtimeInput.mode);
      throw error;
    }
    const response = this.responseValidator.validate(raw, { mode: runtimeInput.mode });
    this.memoryService.saveUpdate(response.memoryUpdate, runtimeInput.message);
    const reflection = this.reflectionService.reflect({
      message: runtimeInput.message,
      reply: response.reply,
      recentMessages: runtimeInput.recentMessages,
      mode: runtimeInput.mode,
      memoryUpdate: response.memoryUpdate,
      improvementIdea: runtimeInput.improvementIdea
    });
    this.improvementService.captureFromReflection(reflection);
    return response;
  }

  reflect(input = {}) {
    const runtimeInput = this.prepareInput(input);
    const reflection = this.reflectionService.reflect({
      message: runtimeInput.message,
      reply: "Manual reflection completed.",
      recentMessages: runtimeInput.recentMessages,
      mode: runtimeInput.mode
    });
    const improvementSuggestions = this.improvementService.captureFromReflection(reflection);
    return {
      reply: "Fine. I looked back through the water. Nothing exploded.",
      coinsDelta: 0,
      memoryUpdate: {},
      shouldLog: false,
      improvement: null,
      workOrder: null,
      mode: runtimeInput.mode,
      suggestedActions: [],
      reflection: reflection ? {
        id: reflection.id,
        improvementSuggestions: improvementSuggestions.length
      } : null
    };
  }

  prepareInput(input = {}) {
    const mode = String(input.mode || "normal");
    return {
      message: String(input.message || ""),
      mode,
      playerMemory: this.memoryService.forRequest(input.playerMemory || {}),
      recentMessages: Array.isArray(input.recentMessages) ? input.recentMessages.slice(-12) : [],
      improvementIdea: input.improvementIdea || null,
      improvementReview: input.improvementReview || null,
      improvementDecision: input.improvementDecision || null,
      lastImprovementDecision: input.lastImprovementDecision || null,
      decision: input.decision || null
    };
  }

  health(mode = "normal") {
    const provider = this.providerService.health();
    return {
      provider: provider.provider,
      model: provider.model,
      hasProvider: provider.configured,
      constitutionLoaded: this.promptService.hasFile("grimm/constitution.md"),
      promptFilesLoaded: [
        ...this.promptService.coreFiles(),
        ...this.promptService.promptFiles(mode)
      ].filter(file => this.promptService.hasFile(file))
    };
  }

  providerUnavailable(mode = "normal") {
    return {
      reply: "Grimm is asleep.\nStart Ollama to wake him.",
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
