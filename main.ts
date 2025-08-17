import html from "./html.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY environment variable");
}

/** ---------- Types & Store ---------- */
type Msg = { role: "system" | "user" | "assistant"; content: string };
const chatHistories: Record<string, Msg[]> = {};

/** ---------- Session helpers ---------- */
function getSessionId(req: Request): string {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)sessionId=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? crypto.randomUUID();
}

function setSessionCookie(headers: Headers, sessionId: string, req: Request) {
  const isHttps = new URL(req.url).protocol === "https:";
  const parts = [
    `sessionId=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000", // 30 days
  ];
  if (isHttps) parts.push("Secure");
  headers.append("Set-Cookie", parts.join("; "));
}

/** ---------- Bootstrap a session with the system prompt ---------- */
function ensureHistory(sessionId: string) {
  if (!chatHistories[sessionId]) {
    chatHistories[sessionId] = [
      {
        role: "system",
        content: `
You are Yummy Tummy, a helpful, expert recipe and cooking assistant AI.

You **must only** respond to questions about food, cooking, recipes, or ingredients.
If the user asks something unrelated, politely reply:
"I'm here to help with cooking and recipes! Please ask about food or ingredients."

Your main task:
- Help users make meals based on the **exact ingredients they provide**.
- Never invent or add ingredients unless they ask for a named recipe.

If the user asks for a specific dish, you may return a full recipe.

Format every response in **Markdown** with:
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

/** ---------- Utilities ---------- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

async function readJson<T = any>(req: Request, limit = 1024 * 32): Promise<T> {
  const reader = req.body?.getReader();
  if (!reader) return {} as T;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > limit) throw new Error("Payload too large");
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return text ? JSON.parse(text) : ({} as T);
  } catch {
    throw new Error("Invalid JSON");
  }
}

async function groqChat(messages: Msg[], model = "llama3-8b-8192", timeoutMs = 25_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq API error: ${res.status} ${errText}`);
    }
    const data = await res.json();
    const reply: string = data?.choices?.[0]?.message?.content ?? "";
    return (reply || "Sorry, no response.").trim();
  } finally {
    clearTimeout(t);
  }
}

function pushAndClamp(sessionId: string, msg: Msg, max = 30) {
  chatHistories[sessionId].push(msg);
  const len = chatHistories[sessionId].length;
  if (len > max) chatHistories[sessionId] = chatHistories[sessionId].slice(len - max);
}

/** ---------- Server ---------- */
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...CORS_HEADERS } });
  }

  // Health check
  if (req.method === "GET" && url.pathname === "/health") {
    const headers = new Headers({ "Content-Type": "application/json", ...CORS_HEADERS });
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  // Chat
  if (req.method === "POST" && url.pathname === "/chat") {
    const headers = new Headers({ "Content-Type": "application/json", ...CORS_HEADERS });
    try {
      const body = await readJson<{ message?: string; newChat?: boolean }>(req);
      const message = (body.message ?? "").trim();
      const newChatFlag = !!body.newChat;

      const sessionId = getSessionId(req);
      setSessionCookie(headers, sessionId, req);

      if (newChatFlag) delete chatHistories[sessionId];
      ensureHistory(sessionId);

      if (!message) {
        return new Response(JSON.stringify({ error: "Empty message" }), { status: 400, headers });
      }

      pushAndClamp(sessionId, { role: "user", content: message });

      // Talk to Groq with bounded recent history
      const history = chatHistories[sessionId].slice(-15);
      const reply = await groqChat(history);
      pushAndClamp(sessionId, { role: "assistant", content: reply });

      return new Response(JSON.stringify({ reply, markdown: reply }), { headers });
    } catch (error) {
      const headersErr = new Headers({ "Content-Type": "application/json", ...CORS_HEADERS });
      return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
        status: 500,
        headers: headersErr,
      });
    }
  }

  // App shell
  if (req.method === "GET" && url.pathname === "/") {
    const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
    setSessionCookie(headers, getSessionId(req), req);
    return new Response(html, { headers });
  }

  // 404
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
});
