export class OllamaProvider {
  constructor({
    baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model = process.env.OLLAMA_MODEL || "qwen2.5:1.5b"
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.model = model;
  }

  get configured() {
    return true;
  }

  async checkHealth() {
    const response = await fetch(`${this.baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw new Error(`Ollama tags failed: ${response.status}`);
    return true;
  }

  async generate(prompt, { systemInstruction = "" } = {}) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: "json",
        messages: [
          ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
          { role: "user", content: prompt }
        ],
        options: {
          temperature: 0.7,
          num_predict: 900
        }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Ollama failed: ${response.status} ${data.error || ""}`.trim());
    return String(data.message?.content || data.response || "").trim();
  }
}
