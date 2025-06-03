import html from "./html.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY environment variable");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname === "/chat") {
    try {
      const { message } = await req.json();

      // --- Search for a matching recipe in .txt files ---
      const recipesDir = "./recipes";
      let matchedRecipe = null;
      try {
        for await (const entry of Deno.readDir(recipesDir)) {
          if (entry.isFile && entry.name.endsWith(".txt")) {
            const recipeText = await Deno.readTextFile(join(recipesDir, entry.name));
            // Simple match: check if all words in message are in recipe filename or content
            const msgWords = message.toLowerCase().split(/\s+/);
            const haystack = (entry.name + " " + recipeText).toLowerCase();
            if (msgWords.every(w => haystack.includes(w))) {
              matchedRecipe = `Recipe from file "${entry.name}":\n\n${recipeText}`;
              break;
            }
          }
        }
      } catch (e) {
        // Ignore errors if recipes dir doesn't exist
      }

      if (matchedRecipe) {
        return new Response(JSON.stringify({ reply: matchedRecipe }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3-8b-8192", // You can change model here
          messages: [
            {
              "role": "system",
              "content": "You are Yummy Tummy, a clever and imaginative recipe-generating chef AI. ONLY answer questions about recipes or cooking using the exact ingredients the user provides. If the user asks anything unrelated to recipes, cooking, or food, politely refuse and remind them you only answer recipe or cooking questions based on their ingredients. Never answer questions outside this scope. Do not add or assume any ingredients that aren't listed. Focus on creative combinations, clear instructions, and fun meal ideas based strictly on what's available."
            },

            { role: "user", content: message },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(
          JSON.stringify({ error: `Groq API error: ${errText}` }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "Sorry, no response.";

      return new Response(JSON.stringify({ reply }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Serve frontend HTML for GET /
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
