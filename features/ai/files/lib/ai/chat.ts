import env from "@configs/env";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DEFAULT_GOOGLE_AI_MODEL_FALLBACK } from "./defaultModelFallback";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResult = {
  reply: string;
  model: string;
};

export async function generateChat(messages: ChatMessage[]): Promise<ChatResult> {
  const apiKey = env.googleAiApiKey?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not set");
  }
  if (!messages.length) {
    throw new Error("messages array is required");
  }

  const modelIds =
    env.googleAiModelFallback.length > 0
      ? env.googleAiModelFallback
      : [...DEFAULT_GOOGLE_AI_MODEL_FALLBACK];

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of modelIds) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));
      const last = messages[messages.length - 1]!;
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(last.content);
      return { reply: result.response.text(), model: modelName };
    } catch (e) {
      lastError = e;
    }
  }

  const msg =
    lastError instanceof Error ? lastError.message : String(lastError ?? "AI failed");
  throw new Error(msg);
}
