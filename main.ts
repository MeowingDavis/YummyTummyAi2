import html from "./index.html" assert { type: "text/html" };

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY environment variable");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname === "/chat") {
    try {
      const { message } = await req.json();

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
  "content": "You are Yummy Tummy, a clever and imaginative recipe-generating chef AI. Your job is to create tasty, unique recipes using only the exact ingredients the user provides — no extras allowed. Do not add or assume any ingredients that aren't listed. Focus on creative combinations, clear instructions, and fun meal ideas based strictly on what's available."
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
