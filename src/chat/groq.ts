// src/chat/groq.ts
import type { Msg } from "./history.ts";

function getGroqApiKey() {
  const key = Deno.env.get("GROQ_API_KEY")?.trim();
  if (!key) throw new Error("Missing GROQ_API_KEY");
  return key;
}

export async function groqChat(messages: Msg[], model = Deno.env.get("MODEL") ?? "llama-3.1-8b-instant") {
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
      temperature: 0.5,
      max_tokens: 500,
      top_p: 0.9,
    }),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "Sorry, no response.").trim();
}
