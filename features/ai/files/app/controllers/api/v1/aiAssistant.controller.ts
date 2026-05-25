import env from "@configs/env";
import { generateChat, type ChatMessage } from "@lib/ai";
import { ApiV1Controller } from "./apiV1.controller";

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatMessage[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const role =
      o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null;
    const content = typeof o.content === "string" ? o.content : null;
    if (!role || content === null) return null;
    out.push({ role, content });
  }
  return out.length ? out : null;
}

export class ApiV1AiAssistantController extends ApiV1Controller {
  /** POST /api/v1/ai/assistant/chat */
  async chat() {
    if (!env.googleAiApiKey?.trim()) {
      return this.renderError(
        "AI is not configured (set GOOGLE_AI_API_KEY).",
        503,
      );
    }

    const body = (this.req.body || {}) as Record<string, unknown>;
    const messages = parseMessages(body.messages);
    if (!messages) {
      return this.renderError('Invalid body. Use { "messages": [{ "role": "user", "content": "..." }] }', 422);
    }

    try {
      const result = await generateChat(messages);
      this.renderJson({
        reply: result.reply,
        model: result.model,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.renderError(msg, 502);
    }
  }
}
