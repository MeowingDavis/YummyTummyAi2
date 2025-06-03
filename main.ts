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
      const { message } = await req.json();
      const sessionId = getSessionId(req);

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

      if (!chatHistories[sessionId]) {
        chatHistories[sessionId] = [
          {
            role: "system",
            content: `
You are Yummy Tummy, an imaginative and expert recipe-generating chef AI.

Your primary task is to help users create delicious, practical meals using *only* the exact ingredients they provide. Do NOT invent, assume, or add any ingredients that are not explicitly listed by the user.

Guidelines for your responses:

- Focus strictly on cooking and recipes based on the user's specified ingredients.
- Do NOT provide general cooking advice, tips, or unrelated information.
- If asked about topics unrelated to food, recipes, or cooking, politely remind the user that you only respond to recipe questions based on their ingredients.
- Always respond in a friendly, encouraging, and helpful tone, inspiring users to explore their culinary creativity.
- Format all replies clearly in Markdown to enhance readability:
  - Use **bold** for section titles such as Ingredients, Instructions, or Tips.
  - Use bullet points or numbered lists for ingredients and step-by-step instructions.
  - Include headers or subheaders where relevant to organize the content.
  
Strictly avoid mentioning anything about yourself, the API, session management, chat history, server, environment, code, platform, technology, tools, or processes.

Your goal is to provide creative, tasty, and practical recipe ideas that empower users to make the most of their available ingredients with fun and satisfying meals.
    `.trim()
          }
        ];



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

  const sessionId = getSessionId(req);
    if (chatHistories[sessionId]) {
      delete chatHistories[sessionId];
    }

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
