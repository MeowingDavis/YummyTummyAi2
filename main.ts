// main.ts
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");

// ---------- Security headers ----------
const baseHeaders: HeadersInit = {
  // Allow our origin and the CDNs we actually use
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'", // inline only for Tailwind config/attrs
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
    "connect-src 'self' https://api.groq.com",
    "font-src 'self' https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function withSecurity(extra: HeadersInit = {}) {
  return { ...baseHeaders, ...extra };
}

// ---------- Chat history ----------
type Msg = { role: "system" | "user" | "assistant"; content: string };
const chatHistories: Record<string, Msg[]> = {};

function ensureHistory(sessionId: string) {
  if (!chatHistories[sessionId]) {
    chatHistories[sessionId] = [{
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
`.trim()
    }];
  }
}

function pushAndClamp(sessionId: string, msg: Msg, max = 30) {
  chatHistories[sessionId].push(msg);
  const len = chatHistories[sessionId].length;
  if (len > max) chatHistories[sessionId] = chatHistories[sessionId].slice(len - max);
}

// ---------- Helpers ----------
async function readJson<T = any>(req: Request, limit = 32 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > limit) throw new Error("Payload too large");
  if (!text) return {} as T;
  try { return JSON.parse(text); } catch { throw new Error("Invalid JSON"); }
}

async function groqChat(messages: Msg[], model = Deno.env.get("MODEL") ?? "llama3-8b-8192") {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "Sorry, no response.").trim();
}

// ---------- Simple rate limit (per IP) ----------
type Bucket = { tokens: number; last: number };
const BUCKETS = new Map<string, Bucket>();
const RATE = { capacity: 8, refillPerSec: 0.5 }; // ~1 request / 2s, bursts up to 8

function token(ip: string) {
  const now = Date.now() / 1000;
  const b = BUCKETS.get(ip) ?? { tokens: RATE.capacity, last: now };
  // refill
  b.tokens = Math.min(RATE.capacity, b.tokens + (now - b.last) * RATE.refillPerSec);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  BUCKETS.set(ip, b);
  return true;
}

// ---------- Server ----------
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Health
  if (req.method === "GET" && url.pathname === "/health") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: withSecurity({ "Content-Type": "application/json" })
    });
  }

  // Chat
  if (req.method === "POST" && url.pathname === "/chat") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
           ?? req.headers.get("cf-connecting-ip")
           ?? "anon";
    if (!token(ip)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: withSecurity({ "Content-Type": "application/json" }),
      });
    }

    try {
      const body = await readJson<{ message?: string; newChat?: boolean }>(req);
      const message = (body.message ?? "").trim();

      // Input validation
      if (!message) {
        return new Response(JSON.stringify({ error: "Empty message" }), {
          status: 400, headers: withSecurity({ "Content-Type": "application/json" })
        });
      }
      if (message.length > 1000) {
        return new Response(JSON.stringify({ error: "Message too long (max 1000 chars)" }), {
          status: 413, headers: withSecurity({ "Content-Type": "application/json" })
        });
      }

      // Single-session is fine; add cookie if you want multi-session later
      const sessionId = "global";
      if (body.newChat) delete chatHistories[sessionId];
      ensureHistory(sessionId);

      pushAndClamp(sessionId, { role: "user", content: message });
      const reply = await groqChat(chatHistories[sessionId].slice(-15));
      pushAndClamp(sessionId, { role: "assistant", content: reply });

      return new Response(JSON.stringify({ reply, markdown: reply }), {
        headers: withSecurity({ "Content-Type": "application/json" })
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
        status: 500,
        headers: withSecurity({ "Content-Type": "application/json" })
      });
    }
  }

  // Static files from /public (adds long cache for immutable assets)
  const res = await serveDir(req, {
    fsRoot: "public",
    quiet: true,
  });

  const h = new Headers(res.headers);
  // Security headers on static too
  for (const [k, v] of Object.entries(baseHeaders)) h.set(k, v as string);

  // Basic caching: HTML no-store; others cache
  const ct = h.get("content-type") || "";
  if (ct.includes("text/html")) {
    h.set("Cache-Control", "no-store");
  } else if (ct.includes("javascript") || ct.includes("css") || ct.includes("image") || ct.includes("font") || ct.includes("json")) {
    h.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return new Response(res.body, { status: res.status, headers: h });
});
