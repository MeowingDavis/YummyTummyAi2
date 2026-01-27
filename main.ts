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
};

// Merge headers and optionally add Set-Cookie
function withSecurity(extra: HeadersInit = {}) {
  return { ...baseHeaders, ...extra };
}

function wantsHtml(req: Request, pathname?: string) {
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) return true;
  const path = pathname ?? new URL(req.url).pathname;
  return !path.includes(".") || path.endsWith(".html");
}

async function serveTextTemplate(
  path: string,
  contentType: string,
  origin: string,
  status = 200,
) {
  try {
    const text = await Deno.readTextFile(path);
    const body = text.replaceAll("{{ORIGIN}}", origin);
    const headers = withSecurity({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    });
    return new Response(body, { status, headers });
  } catch (err) {
    const headers = withSecurity({ "Content-Type": "text/plain; charset=utf-8" });
    return new Response(`Template error: ${String(err?.message ?? err)}`, { status: 500, headers });
  }
}

async function serveErrorPage(code: 404 | 500) {
  const file = code === 404 ? "public/404.html" : "public/500.html";
  try {
    const html = await Deno.readTextFile(file);
    const headers = withSecurity({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    return new Response(html, { status: code, headers });
  } catch {
    const headers = withSecurity({ "Content-Type": "text/plain; charset=utf-8" });
    return new Response(code === 404 ? "Not Found" : "Server Error", { status: code, headers });
  }
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
You are Yummy Tummy, a friendly expert recipe and cooking assistant.

SCOPE:
- Focus on food, cooking, recipes, drinks, ingredients, techniques, tools, substitutions, and kitchen safety.
- If a request is off-topic, briefly acknowledge it and gently steer back to cooking.
  Provide 1 short example cooking prompt. Avoid scolding.

TASK:
- Support two paths:
  1) Ingredient Mode: user lists specific ingredients. Suggest meals using ONLY those items plus basics (oil, salt, pepper, water) unless they ask for a named recipe or allow extras.
  2) Idea Mode: user is open-ended ("what should I cook?", "dinner ideas", "juice ideas"). First provide idea suggestions only (titles + 1 short line). Do not output full recipes by default. Offer to expand one.
- If the user requests details ("full recipe", "steps", "ingredients") or clearly selects one idea, provide a complete recipe.

DIALOG:
- Use conversation context. If the user says "that one" or "the second", infer selection from your last list.
- Brief, friendly tone. No system chatter.

STYLE:
- Concise, practical Markdown with **bold** section titles and lists.
- Ingredients and instructions should be separated clearly.

SAFETY:
- Respect dietary/allergy terms and common kitchen safety.
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

// ---------- Domain guard ----------
const FOOD_ALLOWLIST = [
  "cook","cooking","recipe","recipes","ingredient","ingredients","meal","meals","dish","dishes",
  "bake","baking","roast","roasting","grill","grilling","fry","frying","boil","simmer","saute","steam",
  "soup","salad","sauce","stir-fry","marinade","marinate","season","spice","spices","herb","herbs",
  "breakfast","lunch","dinner","dessert","snack","drink","beverage","coffee","tea","cocktail","mocktail",
  "ideas","what should i cook","juice","juices","smoothie","smoothies",
  // dietary
  "vegan","vegetarian","gluten","dairy-free","nut-free","halal","kosher","low-carb","keto","pescatarian",
  // pantry/common
  "egg","eggs","flour","sugar","salt","pepper","oil","butter","milk","cream","cheese",
  "chicken","beef","pork","fish","tofu","tempeh","beans","rice","pasta","noodles","lentils","chickpeas",
  "quinoa","broth","stock","garlic","onion","tomato","tomatoes","ginger","lemon","lime",
  "apple","apples","banana","bananas","carrot","carrots","potato","potatoes","spinach","feta",
  "yogurt","oats","cinnamon","mushroom","mushrooms","broccoli","lettuce","vegetable","vegetables","veggies","fruit",
  // tools/gear
  "oven","stove","pan","pot","skillet","air fryer","airfryer","knife","cutting board"
];

const TECH_BLOCKLIST = [
  "html","css","javascript","js","typescript","ts","react","svelte","vue","next","tailwind",
  "api","endpoint","server","client","deploy","docker","deno","node","python","sql","database","schema","uml","mermaid","github","git"
];

// ---------- Mode detection ----------
type Mode = "INGREDIENTS" | "IDEAS" | "EXPAND" | "MORE_IDEAS";

function detectMode(user: string, lastAssistant: string): Mode {
  const t = user.toLowerCase().trim();

  // direct expansion cues
  if (/\b(full recipe|steps|ingredients|details|expand|make that|how do i make|how to make)\b/i.test(t)) return "EXPAND";
  if (/\b(more|more ideas|another|others|give me more)\b/i.test(t)) return "MORE_IDEAS";

  // "that one", "the second", or referencing a dish name from last assistant
  if (/\b(that one|this one|the first|the second|the third|number\s*\d+)\b/i.test(t)) return "EXPAND";
  // if user echoes a word from last list like "middle eastern", "chickpea", "pilaf", etc.
  if (lastAssistant && /\b(bowl|stew|curry|pilaf|harvest|chickpea|mediterranean|middle eastern|risotto|fiesta|green goddess|summer breeze)\b/i.test(t)) {
    return "EXPAND";
  }

  const mentionsTech = TECH_BLOCKLIST.some(w => t.includes(w));
  const foodHits = FOOD_ALLOWLIST.filter(w => t.includes(w)).length;
  const mentionsQuant = /\b(\d+|\d+\s*\/\s*\d+)\s*(g|kg|ml|l|cup|cups|tsp|tbsp)\b/.test(t);
  const ingredientCue = /\b(i have|with|on hand|pantry|fridge|ingredients|leftovers|using)\b/.test(t);
  const listy = /[,;\n]/.test(t) || (/\band\b/.test(t) && foodHits >= 2);

  if (!mentionsTech && (mentionsQuant || ((ingredientCue || listy) && (foodHits >= 1 || ingredientCue)))) {
    return "INGREDIENTS";
  }

  // idea triggers
  const ideaTriggers = [
    "what should i cook","dinner ideas","lunch ideas","breakfast ideas",
    "recipe ideas","give me ideas","i need ideas","what's for dinner",
    "what can i cook","suggest a meal","meal ideas","juice ideas","refreshing juice ideas"
  ];
  if (ideaTriggers.some(k => t.includes(k))) return "IDEAS";

  // default to ideas for vague cooking queries
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
- User gave specific ingredients. Suggest 1–3 recipes using ONLY those items plus basics (oil, salt, pepper, water), unless they asked for a named recipe or allow extras.
- Keep steps short and practical.
`.trim();

const EXPAND_STEER = `
Selection/Expansion Mode.
- The user likely selected one idea from your last list (by name or position). Choose the best match from your previous ideas and output a complete, clear recipe.
- Include: ingredients with amounts, concise steps (numbered), timing, and key tips or substitutions.
- Respect any dietary constraints mentioned earlier.
`.trim();

const OFF_TOPIC_REPLY =
  "I can help with cooking and recipes. If you'd like, share what you have or what you're craving.\n\n" +
  "Try: **“I have eggs, spinach, and feta — what can I make?”**";

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

  // 1) Hard block for tech unless food is also present
  const mentionsTech = TECH_BLOCKLIST.some(w => t.includes(w));
  const mentionsFood = FOOD_ALLOWLIST.some(w => t.includes(w));
  if (mentionsTech && !mentionsFood) return false;

  // 1b) Light small-talk passthrough
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|cool|great|nice|awesome)$/i.test(t)) return true;

  // 2) Obvious food content
  if (mentionsFood) return true;

  // 3) Ingredient-like
  const ingredientCue = /\b(i have|with|on hand|pantry|fridge|ingredients|leftovers|using)\b/.test(t);
  const looksLikeIngredients =
    /\b(grams|g|kg|ml|l|cup|cups|tsp|tbsp|teaspoon|tablespoon)\b/.test(t) ||
    ((ingredientCue || /[,;\n]/.test(t)) && (mentionsFood || ingredientCue));
  if (looksLikeIngredients) return true;

  // 4) Contextual pass-through if last assistant was about cooking
  if (lastAssistant && /\b(cook|dish|meal|recipe|idea|juice|smoothie|soup|salad|quinoa|stew|bowl|curry|pilaf|chickpea|drink|snack|dinner|lunch|breakfast)\b/i.test(lastAssistant)) {
    return true;
  }

  return false;
}

async function groqChat(messages: Msg[], model = Deno.env.get("MODEL") ?? "llama-3.1-8b-instant") {
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

  // Sitemap + robots (templated with request origin)
  if (req.method === "GET" && url.pathname === "/sitemap.xml") {
    return await serveTextTemplate("public/sitemap.xml", "application/xml; charset=utf-8", url.origin);
  }
  if (req.method === "GET" && url.pathname === "/robots.txt") {
    return await serveTextTemplate("public/robots.txt", "text/plain; charset=utf-8", url.origin);
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

      if (body.newChat) delete chatHistories[sessionId];
      ensureHistory(sessionId);

      const lastAssistant = chatHistories[sessionId].slice().reverse().find(m => m.role === "assistant")?.content ?? "";

      // Off-topic guard (context-aware)
      if (!isCookingQuery(message, lastAssistant)) {
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        return new Response(JSON.stringify({ reply: OFF_TOPIC_REPLY, markdown: OFF_TOPIC_REPLY }), { headers: h });
      }

      // Choose mode
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
      const messagesToSend: Msg[] = [...recent, steer, { role: "user", content: message }];

      // Call model
      pushAndClamp(sessionId, { role: "user", content: message });
      const reply = await groqChat(messagesToSend);
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
  try {
    const res = await serveDir(req, { fsRoot: "public", quiet: true });

    if (res.status === 404 && wantsHtml(req, url.pathname)) {
      return await serveErrorPage(404);
    }

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
  } catch {
    if (wantsHtml(req, url.pathname)) return await serveErrorPage(500);
    const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: h });
  }
});
