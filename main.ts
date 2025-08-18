// main.ts
// Run locally: deno run --allow-net --allow-read --allow-env main.ts
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");

// ---------- Security headers (CSP allows Tailwind + jsDelivr) ----------
const baseHeaders: HeadersInit = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    // Allow both official Tailwind CDN and jsDelivr libs
    "script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net 'unsafe-inline'",
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
    chatHistories[sessionId] = [
      {
        role: "system",
        content: `
You are Yummy Tummy, a helpful, expert recipe and cooking assistant AI.

SCOPE:
- You ONLY respond to questions about food, cooking, recipes, or ingredients.
- If the user asks about code, HTML/CSS/JS, APIs, deployment, or anything not related to cooking, you MUST refuse with:
  "I'm here to help with cooking and recipes! Please ask about food or ingredients."
  Then give 1 short example prompt relevant to cooking.

TASK:
- Help users make meals from the exact ingredients they provide. Do NOT add ingredients unless the user requests a named recipe.
- If the user asks for a specific dish, you may output a full recipe.

STYLE:
- Keep responses concise and practical.
- Format in Markdown with **bold** section headings and bulleted/numbered lists.
- No self-talk about being fast, systems, or APIs.

SAFETY:
- If dietary/allergy terms appear, acknowledge and respect them.
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

// ---------- Simple domain guard (server-side) ----------
const FOOD_ALLOWLIST = [
  // general cooking terms
  "cook","cooking","recipe","recipes","ingredient","ingredients","meal","meals","dish","dishes",
  "bake","baking","roast","roasting","grill","grilling","fry","frying","boil","simmer","saute","steam",
  "soup","salad","sauce","stir-fry","marinade","marinate","season","spice","spices","herb","herbs",
  "breakfast","lunch","dinner","dessert","snack","drink","beverage",
  // dietary
  "vegan","vegetarian","gluten","dairy-free","nut-free","halal","kosher","low-carb","keto",
  // pantry/common
  "egg","eggs","flour","sugar","salt","pepper","oil","butter","milk","cream","cheese",
  "chicken","beef","pork","fish","tofu","tempeh","beans","rice","pasta",
  // coffee/tea (since you used cold press)
  "coffee","cold brew","cold press","espresso","latte","tea","matcha"
];

const TECH_BLOCKLIST = [
  "html","css","javascript","js","typescript","ts","react","svelte","vue","next","tailwind",
  "api","endpoint","server","client","deploy","docker","deno","node","python","sql","database","schema","uml","mermaid","github","git"
];

function isCookingQuery(s: string): boolean {
  const t = s.toLowerCase();
  // block if it clearly asks for code/tech (unless it also mentions obvious food words)
  const mentionsTech = TECH_BLOCKLIST.some(w => t.includes(w));
  const mentionsFood = FOOD_ALLOWLIST.some(w => t.includes(w));
  if (mentionsTech && !mentionsFood) return false;

  // allow if any food word appears OR the text looks like ingredients (comma/line separated nouns)
  if (mentionsFood) return true;

  // very lightweight "ingredients line" heuristic
  const looksLikeIngredients = /[,;\n]/.test(t) && /\b(grams|g|kg|ml|l|cup|cups|tsp|tbsp|teaspoon|tablespoon)\b/.test(t);
  return looksLikeIngredients;
}

const OFF_TOPIC_REPLY =
  "I'm here to help with cooking and recipes! Please ask about food or ingredients.\n\n" +
  "💡 Try: **“I have eggs, spinach, and feta — what can I make?”**";

// ---------- Helpers ----------
async function readJson<T = any>(req: Request, limit = 32 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > limit) throw new Error("Payload too large");
  if (!text) return {} as T;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }
}

async function groqChat(
  messages: Msg[],
  model = Deno.env.get("MODEL") ?? "llama-3.1-8b-instant",
) {
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
      max_tokens: 400,
      top_p: 0.9,
    }),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "Sorry, no response.").trim();
}

// ---------- Simple rate limiting (per IP) ----------
type Bucket = { tokens: number; last: number };
const BUCKETS = new Map<string, Bucket>();
const RATE = { capacity: 8, refillPerSec: 0.5 }; // ~1 req/2s, burst up to 8

function allow(ip: string) {
  const now = Date.now() / 1000;
  const b = BUCKETS.get(ip) ?? { tokens: RATE.capacity, last: now };
  // refill
  b.tokens = Math.min(RATE.capacity, b.tokens + (now - b.last) * RATE.refillPerSec);
  b.last = now;
  if (b.tokens < 1) {
    BUCKETS.set(ip, b);
    return false;
  }
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
      headers: withSecurity({ "Content-Type": "application/json" }),
    });
    }

  // Chat endpoint
  if (req.method === "POST" && url.pathname === "/chat") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "anon";

    if (!allow(ip)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: withSecurity({ "Content-Type": "application/json" }),
      });
    }

    try {
      const body = await readJson<{ message?: string; newChat?: boolean }>(req);
      const message = (body.message ?? "").trim();

      // Validation
      if (!message) {
        return new Response(JSON.stringify({ error: "Empty message" }), {
          status: 400,
          headers: withSecurity({ "Content-Type": "application/json" }),
        });
      }
      if (message.length > 1000) {
        return new Response(JSON.stringify({ error: "Message too long (max 1000 chars)" }), {
          status: 413,
          headers: withSecurity({ "Content-Type": "application/json" }),
        });
      }

      // Off-topic hard gate BEFORE calling the model
      if (!isCookingQuery(message)) {
        return new Response(JSON.stringify({ reply: OFF_TOPIC_REPLY, markdown: OFF_TOPIC_REPLY }), {
          headers: withSecurity({ "Content-Type": "application/json" }),
        });
      }

      // Single-session memory; swap to cookie if you want multi-session per user
      const sessionId = "global";
      if (body.newChat) delete chatHistories[sessionId];
      ensureHistory(sessionId);

      pushAndClamp(sessionId, { role: "user", content: message });
      const reply = await groqChat(chatHistories[sessionId].slice(-15));
      pushAndClamp(sessionId, { role: "assistant", content: reply });

      return new Response(JSON.stringify({ reply, markdown: reply }), {
        headers: withSecurity({ "Content-Type": "application/json" }),
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
        status: 500,
        headers: withSecurity({ "Content-Type": "application/json" }),
      });
    }
  }

  // Optional: stub upload so the UI doesn't break if it calls /upload
  if (req.method === "POST" && url.pathname === "/upload") {
    return new Response(JSON.stringify([]), {
      headers: withSecurity({ "Content-Type": "application/json" }),
    });
  }

  // Static files from /public
  const res = await serveDir(req, {
    fsRoot: "public",
    quiet: true,
  });

  // Add security headers + caching to static responses
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(baseHeaders)) h.set(k, v as string);

  const ct = h.get("content-type") || "";
  if (ct.includes("text/html")) {
    h.set("Cache-Control", "no-store");
  } else if (
    ct.includes("javascript") ||
    ct.includes("css") ||
    ct.includes("image") ||
    ct.includes("font") ||
    ct.includes("json") ||
    ct.includes("webmanifest")
  ) {
    h.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return new Response(res.body, { status: res.status, headers: h });
});
