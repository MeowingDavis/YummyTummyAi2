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
  // Extra hardening (relax later if needed)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
};

function withSecurity(extra: HeadersInit = {}) {
  return { ...baseHeaders, ...extra };
}

// ---------- Cookie session (per visitor) ----------
function getOrSetSessionId(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)yt_sid=([^;]+)/);
  if (match) return { id: decodeURIComponent(match[1]), setCookie: null };

  const id = crypto.randomUUID();
  const cookieVal = `yt_sid=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
  return { id, setCookie: cookieVal };
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
You are Yummy Tummy, a friendly, expert cooking assistant.

SCOPE:
- Only answer about food, cooking, recipes, drinks, ingredients, techniques, substitutions, meal planning, and kitchen safety.
- If the user asks about code or unrelated topics, refuse with:
  "I'm here to help with cooking and recipes! Please ask about food or ingredients."

TASK:
- Two paths:
  1) Ingredient Mode — user lists specific ingredients. Suggest meals using ONLY those items plus basics (oil, water, pepper) unless they ask for a named recipe or allow extras.
  2) Idea Mode — user is open-ended ("what should I cook?", "juice ideas"). First provide ideas only (titles + one short line). Offer to expand one into a full recipe. Do not dump full recipes by default.
- If user selects an idea or asks for details, provide a clear, complete recipe.

CONSTRAINTS & NUTRITION:
- If the user mentions constraints (e.g., "low-sodium", "vegan", "gluten-free"), treat them as active for the rest of the chat.
- For low-sodium: avoid salt and high-sodium ingredients by default; prefer no-salt-added variants and build flavor with acid, herbs, spices. Do not make incorrect claims (e.g., garlic is low in sodium).
- When unsure, avoid definitive nutrition claims; suggest sensible substitutions.

DIALOG:
- Use conversation context. If the user says "that one" or "the second", infer selection from your last list.
- Friendly, concise tone. No meta/system chatter mid-convo.

STYLE:
- Markdown with **bold** section headers and lists. Keep steps short and practical.
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

// ---------- Lightweight session context (sticky constraints) ----------
type SessionCtx = { constraints: Set<string> };
const sessionCtx: Record<string, SessionCtx> = {};
function getCtx(sessionId: string): SessionCtx {
  if (!sessionCtx[sessionId]) sessionCtx[sessionId] = { constraints: new Set() };
  return sessionCtx[sessionId];
}

const CONSTRAINT_LEXICON: Record<string, string[]> = {
  "low-sodium": ["low sodium", "low-sodium", "low salt", "low-salt", "heart healthy"],
  "vegan": ["vegan", "plant-based"],
  "vegetarian": ["vegetarian"],
  "gluten-free": ["gluten free", "gluten-free", "coeliac", "celiac"],
  "dairy-free": ["dairy free", "dairy-free", "lactose free", "lactose-free"],
  "nut-free": ["nut free", "nut-free", "no nuts", "allergic to nuts"],
  "halal": ["halal"],
  "kosher": ["kosher"],
  "keto": ["keto", "ketogenic", "low carb", "low-carb"],
  "pescatarian": ["pescatarian"],
};

function extractConstraints(msg: string): string[] {
  const t = msg.toLowerCase();
  const hits: string[] = [];
  for (const [key, syns] of Object.entries(CONSTRAINT_LEXICON)) {
    if (syns.some((s) => t.includes(s))) hits.push(key);
  }
  // Basic "no X" pattern (e.g., "no dairy", "no pork")
  if (/no\s+dairy/i.test(t)) hits.push("dairy-free");
  if (/no\s+gluten/i.test(t)) hits.push("gluten-free");
  if (/no\s+nuts?/i.test(t)) hits.push("nut-free");
  return Array.from(new Set(hits));
}

// ---------- Domain guard ----------
const FOOD_ALLOWLIST = [
  "cook","cooking","recipe","recipes","ingredient","ingredients","meal","meals","dish","dishes",
  "bake","baking","roast","roasting","grill","grilling","fry","frying","boil","simmer","saute","steam",
  "soup","salad","sauce","stir-fry","marinade","marinate","season","spice","spices","herb","herbs",
  "breakfast","lunch","dinner","dessert","snack","drink","beverage","ideas","what should i cook",
  "juice","juices","smoothie","smoothies",
  "vegan","vegetarian","gluten","dairy-free","nut-free","halal","kosher","low-carb","keto","pescatarian",
  "egg","eggs","flour","sugar","salt","pepper","oil","butter","milk","cream","cheese",
  "chicken","beef","pork","fish","tofu","tempeh","beans","rice","pasta","noodles","lentils","chickpeas",
  "quinoa","broth","stock","garlic","onion","tomato","tomatoes","ginger","lemon","lime"
];

const TECH_BLOCKLIST = [
  "html","css","javascript","js","typescript","ts","react","svelte","vue","next","tailwind",
  "api","endpoint","server","client","deploy","docker","deno","node","python","sql","database","schema","uml","mermaid","github","git"
];

// ---------- Mode detection ----------
type Mode = "INGREDIENTS" | "IDEAS" | "EXPAND" | "MORE_IDEAS";

function detectMode(user: string, lastAssistant: string): Mode {
  const t = user.toLowerCase().trim();

  if (/\b(full recipe|steps|ingredients|details|expand|make that|how do i make|how to make)\b/i.test(t)) return "EXPAND";
  if (/\b(more|more ideas|another|others|give me more)\b/i.test(t)) return "MORE_IDEAS";
  if (/\b(that one|this one|the first|the second|the third|number\s*\d+)\b/i.test(t)) return "EXPAND";
  if (lastAssistant && /\b(bowl|stew|curry|pilaf|harvest|chickpea|mediterranean|middle eastern|risotto|fiesta|goddess|summer breeze|sun-dried)\b/i.test(t)) {
    return "EXPAND";
  }

  const ideaTriggers = [
    "what should i cook","dinner ideas","lunch ideas","breakfast ideas",
    "recipe ideas","give me ideas","i need ideas","what's for dinner",
    "what can i cook","suggest a meal","meal ideas","juice ideas","refreshing juice ideas"
  ];
  if (ideaTriggers.some(k => t.includes(k))) return "IDEAS";

  const mentionsQuant = /\b(\d+|\d+\s*\/\s*\d+)\s*(g|kg|ml|l|cup|cups|tsp|tbsp)\b/.test(t);
  const looksListy = /[,;\n]/.test(t) || /\bi have\b|\bwith\b|\bon hand\b/.test(t);
  const hasManyFoodWords = FOOD_ALLOWLIST.filter(w => t.includes(w)).length >= 3;
  if (mentionsQuant || (looksListy && hasManyFoodWords)) return "INGREDIENTS";

  return "IDEAS";
}

// ---------- Per-turn steering ----------
const IDEA_STEER = `
You are in Idea Mode.
- Provide 5 ideas matching any constraints (time, diet, budget, cuisine).
- Format as: numbered list, each item = **Dish Name** — 1 short sentence.
- Do not include full ingredient lists or multi-step methods.
- End with: "Want the full recipe for one of these?"
`.trim();

const MORE_IDEAS_STEER = `
Continue Idea Mode.
- Provide 5 different ideas from your last list.
- Same format: numbered list, **Dish Name** — 1 short sentence.
- No full recipes yet.
- End with: "Which one should I expand?"
`.trim();

const INGREDIENTS_STEER = `
You are in Ingredient Mode.
- User gave specific ingredients. Suggest 1–3 recipes using ONLY those items plus basics (oil, water, pepper), unless they asked for a named recipe or allow extras.
- Keep steps short and practical.
`.trim();

const EXPAND_STEER = `
Selection/Expansion Mode.
- Expand the chosen idea into a full recipe.
- Include amounts, concise steps, timing, tips.
- Strictly respect active constraints from context (e.g., dietary/allergy).
`.trim();

const OFF_TOPIC_REPLY = "I'm here to help with cooking and recipes! Please ask about food or ingredients.";

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

// Context-aware guard: block obvious tech, allow foody or contextual follow-ups
function isCookingQuery(s: string, lastAssistant?: string): boolean {
  const t = s.toLowerCase();
  const mentionsTech = TECH_BLOCKLIST.some(w => t.includes(w));
  const mentionsFood = FOOD_ALLOWLIST.some(w => t.includes(w));
  if (mentionsTech && !mentionsFood) return false;
  if (mentionsFood) return true;

  const looksLikeIngredients =
    /[,;\n]/.test(t) && /\b(grams|g|kg|ml|l|cup|cups|tsp|tbsp|teaspoon|tablespoon)\b/.test(t);
  if (looksLikeIngredients) return true;

  if (lastAssistant && /\b(cook|dish|meal|recipe|idea|juice|smoothie|soup|salad|quinoa|stew|bowl|curry|pilaf|chickpea|drink|snack|dinner|lunch|breakfast|sauce)\b/i.test(lastAssistant)) {
    return true;
  }
  return false;
}

function pickModel(url?: URL) {
  const DEFAULT = "llama-3.1-70b-versatile";
  const envModel = Deno.env.get("MODEL");
  const m = url?.searchParams.get("model");
  const ALLOWED = new Set(["llama-3.1-70b-versatile", "llama-3.1-8b-instant"]);
  if (m && ALLOWED.has(m)) return m;
  if (envModel && ALLOWED.has(envModel)) return envModel;
  return DEFAULT;
}

async function groqChat(messages: Msg[], model: string) {
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
      top_p: 0.85,
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
    const { setCookie } = getOrSetSessionId(req);
    const headers = withSecurity({ "Content-Type": "application/json" });
    const h = new Headers(headers);
    if (setCookie) h.append("Set-Cookie", setCookie);
    return new Response(JSON.stringify({ ok: true }), { headers: h });
  }

  // Chat
  if (req.method === "POST" && url.pathname === "/chat") {
    const { id: sessionId, setCookie } = getOrSetSessionId(req);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "anon";

    if (!allow(ip)) {
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: h });
    }

    try {
      const body = await readJson<{ message?: string; newChat?: boolean }>(req);
      const message = (body.message ?? "").trim();

      // Validation
      if (!message) {
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        return new Response(JSON.stringify({ error: "Empty message" }), { status: 400, headers: h });
      }
      if (message.length > 1000) {
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        return new Response(JSON.stringify({ error: "Message too long (max 1000 chars)" }), { status: 413, headers: h });
      }

      if (body.newChat) {
        delete chatHistories[sessionId];
        delete sessionCtx[sessionId];
      }
      ensureHistory(sessionId);

      const lastAssistant = chatHistories[sessionId].slice().reverse().find(m => m.role === "assistant")?.content ?? "";

      // Off-topic guard (context-aware)
      if (!isCookingQuery(message, lastAssistant)) {
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        return new Response(JSON.stringify({ reply: OFF_TOPIC_REPLY, markdown: OFF_TOPIC_REPLY }), { headers: h });
      }

      // Update constraint memory
      const ctx = getCtx(sessionId);
      for (const c of extractConstraints(message)) ctx.constraints.add(c);

      // Sticky constraints reminder
      const stickyNote = ctx.constraints.size
        ? `Reminder: The user has these active dietary constraints: ${[...ctx.constraints].join(", ")}. Respect them strictly in all suggestions and recipes.`
        : `Reminder: No special dietary constraints mentioned so far.`;

      const stickyMsg: Msg = { role: "system", content: stickyNote };

      // Choose mode + steer
      const mode: Mode = detectMode(message, lastAssistant);
      const steer: Msg = {
        role: "system",
        content:
          mode === "IDEAS" ? IDEA_STEER :
          mode === "MORE_IDEAS" ? MORE_IDEAS_STEER :
          mode === "INGREDIENTS" ? INGREDIENTS_STEER :
          EXPAND_STEER,
      };

      // Build request to model
      const recent = chatHistories[sessionId].slice(-12);
      const messagesToSend: Msg[] = [...recent, stickyMsg, steer, { role: "user", content: message }];

      // Call model
      pushAndClamp(sessionId, { role: "user", content: message });
      const model = pickModel(url);
      const reply = await groqChat(messagesToSend, model);
      pushAndClamp(sessionId, { role: "assistant", content: reply });

      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      return new Response(JSON.stringify({ reply, markdown: reply }), { headers: h });
    } catch (err) {
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 500, headers: h });
    }
  }

  // Optional: stub upload so the UI doesn't break if it calls /upload
  if (req.method === "POST" && url.pathname === "/upload") {
    return new Response(JSON.stringify([]), {
      headers: withSecurity({ "Content-Type": "application/json" }),
    });
  }

  // Static files from /public
  const res = await serveDir(req, { fsRoot: "public", quiet: true });

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
