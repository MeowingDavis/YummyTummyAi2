// main.ts
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");

type Msg = { role: "system" | "user" | "assistant"; content: string };
const chatHistories: Record<string, Msg[]> = {};

// --- History helpers ---
function ensureHistory(sessionId: string) {
  if (!chatHistories[sessionId]) {
    chatHistories[sessionId] = [
      {
        role: "system",
        content: `
You are Yummy Tummy, a helpful, expert recipe and cooking assistant AI.

You must only respond to questions about food, cooking, recipes, or ingredients.
If the user asks something unrelated, politely reply:
"I'm here to help with cooking and recipes! Please ask about food or ingredients."

Your main task:
- Help users make meals based on the exact ingredients they provide.
- Never invent or add ingredients unless they ask for a named recipe.

If the user asks for a specific dish, you may return a full recipe.

Format every response in Markdown with:
- **Bold** headings (Ingredients, Instructions)
- Bulleted/numbered lists

Tone:
- Friendly, practical, encouraging.
- Never talk about yourself, the system, or APIs.
        `.trim(),
      },
    ];
  }
}

function pushAndClamp(sessionId: string, msg: Msg, max = 30) {
  chatHistories[sessionId].push(msg);
  const len = chatHistories[sessionId].length;
  if (len > max) chatHistories[sessionId] = chatHistories[sessionId].slice(len - max);
}

// --- Utilities ---
async function readJson<T = any>(req: Request, limit = 32 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > limit) throw new Error("Payload too large");
  return text ? JSON.parse(text) : ({} as T);
}

async function groqChat(messages: Msg[], model = "llama3-8b-8192") {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "Sorry, no response.").trim();
}

// --- Server ---
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Health
  if (req.method === "GET" && url.pathname === "/health") {
    return Response.json({ ok: true });
  }

  // Chat
  if (req.method === "POST" && url.pathname === "/chat") {
    try {
      const body = await readJson<{ message?: string; newChat?: boolean }>(req);
      const message = body.message?.trim();
      const sessionId = "global"; // (simplified — could use cookies if you want multiple sessions)

      if (body.newChat) delete chatHistories[sessionId];
      ensureHistory(sessionId);

      if (!message) return Response.json({ error: "Empty message" }, { status: 400 });

      pushAndClamp(sessionId, { role: "user", content: message });
      const reply = await groqChat(chatHistories[sessionId].slice(-15));
      pushAndClamp(sessionId, { role: "assistant", content: reply });

      return Response.json({ reply, markdown: reply });
    } catch (err) {
      return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
    }
  }

  // Static files (public/)
  return serveDir(req, { fsRoot: "public", quiet: true });
});
