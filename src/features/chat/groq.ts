// src/features/chat/groq.ts
import type { Msg } from "./history.ts";

function getGroqApiKey() {
  const key = Deno.env.get("GROQ_API_KEY")?.trim();
  if (!key) throw new Error("Missing GROQ_API_KEY");
  return key;
}

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
let modelCache: { at: number; ids: string[] } | null = null;

function parseModelIds(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const list = (data as { data?: unknown }).data;
  if (!Array.isArray(list)) return [];
  return list
    .map((
      x,
    ) => (x && typeof x === "object" ? (x as { id?: unknown }).id : null))
    .filter((id): id is string =>
      typeof id === "string" && id.trim().length > 0
    );
}

export async function listGroqModels(force = false): Promise<string[]> {
  const now = Date.now();
  if (!force && modelCache && now - modelCache.at < MODEL_CACHE_TTL_MS) {
    return modelCache.ids;
  }

  const GROQ_API_KEY = getGroqApiKey();
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Groq model list error: ${res.status}`);

  const data = await res.json();
  const ids = parseModelIds(data);
  modelCache = { at: now, ids };
  return ids;
}

export async function groqChat(
  messages: Msg[],
  model = Deno.env.get("MODEL") ?? "llama-3.1-8b-instant",
) {
  const GROQ_API_KEY = getGroqApiKey();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 700,
      top_p: 0.95,
    }),
  });
  if (!res.ok) {
    const payload = await res.text().catch(() => "");
    const hint = payload ? ` (${payload.slice(0, 220)})` : "";
    throw new Error(`Groq API error: ${res.status}${hint}`);
  }
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  return text || "Sorry, no response.";
}
