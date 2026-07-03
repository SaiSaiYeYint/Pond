const model = process.env.OPENAI_MODEL || process.env.CLAUDE_MODEL || "gpt-4.1-mini";
const openaiKey = process.env.OPENAI_API_KEY;
const claudeKey = process.env.ANTHROPIC_API_KEY;
const mockWithoutKey = process.env.MOCK_GRIMM_WITHOUT_KEY !== "false";

export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    model,
    hasApiKey: Boolean(openaiKey || claudeKey),
    mode: openaiKey ? "openai" : claudeKey ? "claude" : mockWithoutKey ? "mock" : "missing-key"
  });
}
