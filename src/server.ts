// src/server.ts
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { applySecurityHeaders, withSecurity } from "./security.ts";
import { serveErrorPage, serveTextTemplate, wantsHtml } from "./templates.ts";
import { getOrSetSessionId } from "./session.ts";
import { readJson } from "./http.ts";
import { allow } from "./rateLimit.ts";
import { SYSTEM_PROMPT, OFF_TOPIC_REPLY } from "./chat/prompts.ts";
import { ensureHistory, getHistory, pushAndClamp, clearHistory } from "./chat/history.ts";
import { isCookingQuery } from "./chat/guard.ts";
import { detectMode, steerForMode } from "./chat/modes.ts";
import { groqChat } from "./chat/groq.ts";

export function startServer() {
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

        if (body.newChat) clearHistory(sessionId);
        ensureHistory(sessionId, SYSTEM_PROMPT);

        const history = getHistory(sessionId);
        const lastAssistant = history.slice().reverse().find(m => m.role === "assistant")?.content ?? "";

        // Off-topic guard (context-aware)
        if (!isCookingQuery(message, lastAssistant)) {
          const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
          if (setCookie) h.append("Set-Cookie", setCookie);
          return new Response(JSON.stringify({ reply: OFF_TOPIC_REPLY, markdown: OFF_TOPIC_REPLY }), { headers: h });
        }

        // Choose mode
        const mode = detectMode(message, lastAssistant);
        const steer = steerForMode(mode);

        // Build request to model
        const recent = history.slice(-12);
        const messagesToSend = [...recent, steer, { role: "user", content: message }];

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
      applySecurityHeaders(h);
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
}
