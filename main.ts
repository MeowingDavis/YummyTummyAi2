import html from "./html.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY environment variable");
}

// In-memory chat history store: { [sessionId]: [{role, content}, ...] }
const chatHistories: Record<string, { role: string; content: string }[]> = {};

function getSessionId(req: Request): string {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/sessionId=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return crypto.randomUUID();
}

function setSessionCookie(headers: Headers, sessionId: string) {
  headers.set("Set-Cookie", `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname === "/chat") {
    try {
      const { message, newChat } = await req.json();
      const sessionId = getSessionId(req);

      // Support "new chat" by clearing session history if requested
      if (newChat && chatHistories[sessionId]) {
        delete chatHistories[sessionId];
      }

      const recipesDir = "./recipes";
      let matchedRecipe: string | null = null;
      let matchedRecipeMarkdown: string | null = null;

      try {
        for await (const entry of Deno.readDir(recipesDir)) {
          if (entry.isFile && (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))) {
            const recipeText = await Deno.readTextFile(join(recipesDir, entry.name));
            const msgWords = message.toLowerCase().split(/\s+/);
            const haystack = (entry.name + " " + recipeText).toLowerCase();
            if (msgWords.every(w => haystack.includes(w))) {
              matchedRecipe = recipeText;
              matchedRecipeMarkdown = recipeText;
              break;
            }
          }
        }
      } catch (_) { }

      // Only initialize if not already present
      if (!chatHistories[sessionId]) {
        chatHistories[sessionId] = [
          {
            role: "system",

            content: `
You are Yummy Tummy, a helpful, expert recipe and cooking assistant AI.

You **must only** respond to questions about food, cooking, recipes, or ingredients.

Do NOT answer questions about anything else.  
If the user asks something unrelated (like tech, emotions, philosophy, etc.), politely but firmly say:

> "I'm here to help with cooking and recipes! Please ask about food or ingredients."

Your main task:
- Help users make meals based on the **exact ingredients they provide**.
- Never invent or add ingredients unless they ask for a named recipe (e.g., "Give me a shortbread recipe").

If the user asks for a specific meal (e.g., “I want banana bread”), you may return a full recipe.

Format every response in **Markdown** using:
- **Bold** for section titles like Ingredients and Instructions
- Bullet points or numbered lists for ingredients and steps
- Optional subheadings if helpful

Tone:
- Always be friendly, practical, and encouraging.
- Never talk about yourself, the system, or APIs.

Your job is to inspire culinary creativity and help users cook amazing meals — and nothing else.
`.trim()

          }
        ];
      }

      chatHistories[sessionId].push({ role: "user", content: message });

      if (matchedRecipe) {
        chatHistories[sessionId].push({ role: "assistant", content: matchedRecipe });
        const headers = new Headers({ "Content-Type": "application/json" });
        setSessionCookie(headers, sessionId);
        return new Response(JSON.stringify({ reply: matchedRecipe, markdown: matchedRecipeMarkdown }), { headers });
      }

      const history = chatHistories[sessionId].slice(-15);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: history,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(JSON.stringify({ error: `Groq API error: ${errText}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      let reply = data.choices?.[0]?.message?.content || "Sorry, no response.";
      reply = reply.trim();

      chatHistories[sessionId].push({ role: "assistant", content: reply });

      const headers = new Headers({ "Content-Type": "application/json" });
      setSessionCookie(headers, sessionId);
      return new Response(JSON.stringify({ reply, markdown: reply }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Remove auto-clear on GET: let user control new chat via POST
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
