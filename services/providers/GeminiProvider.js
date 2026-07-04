export class GeminiProvider {
  constructor({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || "gemini-2.5-flash" } = {}) {
    this.apiKey = apiKey;
    this.model = model;
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  async generate(prompt, { systemInstruction = "" } = {}) {
    if (!this.apiKey) throw new Error("GEMINI_API_KEY is missing.");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Gemini failed: ${response.status} ${data.error?.message || ""}`.trim());
    const parts = data.candidates?.[0]?.content?.parts || [];
    return parts.map(part => part.text || "").join("").trim();
  }
}
