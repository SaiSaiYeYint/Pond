import { GeminiProvider } from "./providers/GeminiProvider.js";
import { OllamaProvider } from "./providers/OllamaProvider.js";

export class ProviderService {
  constructor({ providerName = process.env.AI_PROVIDER || process.env.GRIMM_PROVIDER || "ollama", providers = {} } = {}) {
    this.providerName = providerName;
    this.providers = {
      ollama: providers.ollama || new OllamaProvider(),
      gemini: providers.gemini || new GeminiProvider(),
      mock: providers.mock || new MockProvider()
    };
    this.availability = { checked: false, available: true, error: "" };
    this.startupCheck = this.checkAvailability();
  }

  get provider() {
    return this.providers[this.providerName] || this.providers.mock;
  }

  get configured() {
    return Boolean(this.provider?.configured) && this.availability.available;
  }

  get providerConfigured() {
    return Boolean(this.provider?.configured);
  }

  async generate({ systemInstruction = "", userPrompt = "" } = {}) {
    await this.ensureAvailable();
    return this.provider.generate(userPrompt, { systemInstruction });
  }

  async ensureAvailable() {
    await this.startupCheck;
    if (!this.availability.available) throw new Error(this.availability.error || "Provider unavailable.");
  }

  async checkAvailability() {
    if (this.providerName !== "ollama" || typeof this.provider?.checkHealth !== "function") {
      this.availability = { checked: true, available: true, error: "" };
      return this.availability;
    }
    try {
      await this.provider.checkHealth();
      this.availability = { checked: true, available: true, error: "" };
    } catch (error) {
      this.availability = {
        checked: true,
        available: false,
        error: error instanceof Error ? error.message : "Ollama unavailable."
      };
    }
    return this.availability;
  }

  health() {
    const provider = this.provider;
    return {
      provider: this.providerName,
      model: provider?.model || "mock",
      configured: Boolean(provider?.configured),
      available: this.availability.available,
      checked: this.availability.checked
    };
  }
}

class MockProvider {
  constructor() {
    this.model = "mock";
  }

  get configured() {
    return true;
  }

  async generate() {
    return JSON.stringify({
      reply: "Mock brain is awake. Real provider is not configured.",
      coinsDelta: 0,
      memoryUpdate: {},
      shouldLog: false,
      improvement: null,
      workOrder: null,
      mode: "normal",
      suggestedActions: []
    });
  }
}
