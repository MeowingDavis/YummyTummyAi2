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
- Support two paths:
  1) Ingredient Mode: user lists specific ingredients. Help them make meals using ONLY those items plus reasonable basics (oil, salt, pepper, water) unless they ask for a named recipe or allow extras.
  2) Idea Mode: user asks open-ended questions like "What should I cook for dinner?" First provide **idea suggestions only** (titles + 1-line descriptions). Do **not** output full recipes by default. Offer to expand any idea into a full recipe on request.

- If (and only if) the user asks for a specific dish or requests details (“full recipe”, “steps”, “ingredients”), you may output a full recipe.


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
  "breakfast","lunch","dinner","dessert","snack","drink","beverage","ideas","what should i cook",
  // dietary
  "vegan","vegetarian","gluten","dairy-free","nut-free","halal","kosher","low-carb","keto","pescatarian",
  // pantry/common
  "egg","eggs","flour","sugar","salt","pepper","oil","butter","milk","cream","cheese",
  "chicken","beef","pork","fish","tofu","tempeh","beans","rice","pasta","noodles","lentils","chickpeas",
  // coffee/tea (since you used cold press)
  "coffee","cold brew","cold press","espresso","latte","tea","matcha"
];

const TECH_BLOCKLIST = [
  "html","css","javascript","js","typescript","ts","react","svelte","vue","next","tailwind",
  "api","endpoint","server","client","deploy","docker","deno","node","python","sql","database","schema","uml","mermaid","github","git"
];

function isCookingQuery(s: string): boolean {
  const t = s.toLowerCase();
  const mentionsTech = TECH_BLOCKLIST.some(w => t.includes(w));
  const mentionsFood = FOOD_ALLOWLIST.some(w => t.includes(w));
  if (mentionsTech && !mentionsFood) return false;

  if (mentionsFood) return true;

  // very lightweight "ingredients line" heuristic
  const looksLikeIngredients = /[,;\n]/.test(t) && /\b(grams|g|kg|ml|l|cup|cups|tsp|tbsp|teaspoon|tablespoon)\b/.test(t);
  return looksLikeIngredients;
}

const OFF_TOPIC_REPLY =
  "I'm here to help with cooking and recipes! Please ask about food or ingredients.\n\n" +
  "💡 Try: **“I have eggs, spinach, and feta — what can I make?”**";

// ---------- Mode detection helpers ----------
type Mode = "INGREDIENTS" | "IDEAS";

function detectMode(s: string): Mode {
  const t = s.toLowerCase().trim();

  // Obvious idea prompts
  const ideaTriggers = [
    "what should i cook", "dinner ideas", "lunch ideas", "breakfast ideas",
    "recipe ideas", "give me ideas", "i need ideas", "what's for dinner",
    "what can i cook", "suggest a meal", "meal ideas"
  ];
  if (ideaTriggers.some(k => t.includes(k))) return "IDEAS";

  // Looks like an ingredient list: commas or newlines, quantities, or starts with "i have"/"with"
  const mentionsQuant = /\b(\d+|\d+\s*\/\s*\d+)\s*(g|kg|ml|l|cup|cups|tsp|tbsp)\b/.test(t);
  const looksListy = /[,;\n]/.test(t) || /\bi have\b|\bwith\b|\bon hand\b/.test(t);

  // Strong ingredient keywords present
  const hasManyFoodWords = FOOD_ALLOWLIST.filter(w => t.includes(w)).length >= 3;

  if (mentionsQuant || (looksListy && hasManyFoodWords)) return "INGREDIENTS";

  // Default to ideas when ambiguous
  return "IDEAS";
}

// Mode-specific steering for the model (prepended to the turn)
const IDEA_STEER = `
You are in **Idea Mode**.
- The user did not provide a concrete ingredient list.
- Provide **5 dinner ideas** that match any constraints (time, diet, budget, cuisine).
- Format as: numbered list, each item = **Dish Name** — 1 concise sentence describing why it fits.
- Do **not** include full ingredient lists or multi-step methods.
- End with: "Want the full recipe for one of these?"
- Respect diet/allergy terms if present.
`.trim();


const INGREDIENTS_STEER = `
You are in **Ingredient Mode**.
- The user provided specific ingredients.
- Suggest 1–3 recipes that use ONLY those ingredients plus basic staples (oil, salt, pepper, water). Do not invent extras unless they asked for a named recipe or explicitly allow substitutions.
- Keep steps short and practical.
`.trim();

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

      // Decide mode for this turn
      const mode: Mode = detectMode(message);
      const steer: Msg = {
        role: "system",
        content: mode === "IDEAS" ? IDEA_STEER : INGREDIENTS_STEER,
      };

      // Build the message list sent to the model for THIS turn
      // Keep long-term system + last ~12 turns, then add mode steer, then user
      const recent = chatHistories[sessionId].slice(-12);
      const messagesToSend: Msg[] = [...recent, steer, { role: "user", content: message }];

      // Keep history as usual
      pushAndClamp(sessionId, { role: "user", content: message });
      const reply = await groqChat(messagesToSend);
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
