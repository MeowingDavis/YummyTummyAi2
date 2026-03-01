// src/server.ts
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { applySecurityHeaders, withSecurity } from "./security.ts";
import { serveErrorPage, serveTextTemplate, wantsHtml } from "./templates.ts";
import { getOrSetSessionId } from "./session.ts";
import { HttpError, readJson } from "./http.ts";
import { allow, allowSession } from "./rateLimit.ts";
import { SYSTEM_PROMPT, OFF_TOPIC_REPLY } from "./chat/prompts.ts";
import { ensureHistory, getHistory, pushAndClamp, clearHistory } from "./chat/history.ts";
import { isCookingQuery } from "./chat/guard.ts";
import { detectMode, steerForMode } from "./chat/modes.ts";
import { groqChat } from "./chat/groq.ts";
import { redact } from "./redact.ts";

const NODE_ENV = Deno.env.get("NODE_ENV")?.trim().toLowerCase() ?? "";
const IS_PRODUCTION = NODE_ENV === "production";
const CANONICAL_ORIGIN = Deno.env.get("CANONICAL_ORIGIN")?.trim() ?? "";
const ALLOWED_HOSTS = new Set(parseCsv(Deno.env.get("ALLOWED_HOSTS")).map(h => h.toLowerCase()));
const TRUSTED_PROXY_IPS = new Set(parseCsv(Deno.env.get("TRUSTED_PROXY_IPS")));
const IP_RE = /^[0-9a-fA-F:.]+$/;
const CANONICAL_URL = parseCanonicalOrigin(CANONICAL_ORIGIN);

if (IS_PRODUCTION) {
  if (!CANONICAL_URL) {
    throw new Error("Missing or invalid CANONICAL_ORIGIN in production");
  }
  if (!ALLOWED_HOSTS.size) {
    throw new Error("ALLOWED_HOSTS must be set in production");
  }
}

function parseCsv(value: string | undefined) {
  if (!value) return [];
  return value.split(",").map(v => v.trim()).filter(Boolean);
}

function parseCanonicalOrigin(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isAllowedHost(host: string) {
  if (!ALLOWED_HOSTS.size) return true;
  return ALLOWED_HOSTS.has(host.toLowerCase());
}

function getRemoteIp(info: Deno.ServeHandlerInfo) {
  const addr = info.remoteAddr;
  if ("hostname" in addr) return addr.hostname;
  if ("path" in addr) return addr.path;
  return "anon";
}

function getForwardedIp(req: Request) {
  const raw = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip");
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  if (!first || !IP_RE.test(first)) return null;
  return first;
}

function getClientIp(req: Request, info: Deno.ServeHandlerInfo) {
  const remote = getRemoteIp(info);
  if (TRUSTED_PROXY_IPS.has(remote)) {
    return getForwardedIp(req) ?? remote;
  }
  return remote;
}

function publicOrigin(url: URL) {
  return CANONICAL_URL?.origin || url.origin;
}

export function startServer() {
  Deno.serve(async (req, info) => {
    const url = new URL(req.url);
    if (!isAllowedHost(url.host)) {
      const headers = withSecurity({ "Content-Type": "text/plain; charset=utf-8" });
      return new Response("Bad Request", { status: 400, headers });
    }

    // Health
    if (req.method === "GET" && url.pathname === "/health") {
      const { setCookie } = await getOrSetSessionId(req);
      const headers = withSecurity({ "Content-Type": "application/json" });
      const h = new Headers(headers);
      if (setCookie) h.append("Set-Cookie", setCookie);
      return new Response(JSON.stringify({ ok: true }), { headers: h });
    }

    // Sitemap + robots (templated with request origin)
    if (req.method === "GET" && url.pathname === "/sitemap.xml") {
      return await serveTextTemplate("public/sitemap.xml", "application/xml; charset=utf-8", publicOrigin(url));
    }
    if (req.method === "GET" && url.pathname === "/robots.txt") {
      return await serveTextTemplate("public/robots.txt", "text/plain; charset=utf-8", publicOrigin(url));
    }

    // Friendly route aliases
    if (req.method === "GET" && (url.pathname === "/chat" || url.pathname === "/chat/")) {
      return new Response(null, {
        status: 307,
        headers: withSecurity({
          "Location": "/chat.html",
          "Cache-Control": "no-store",
        }),
      });
    }
    if (req.method === "GET" && (url.pathname === "/about" || url.pathname === "/about/")) {
      return new Response(null, {
        status: 307,
        headers: withSecurity({
          "Location": "/about.html",
          "Cache-Control": "no-store",
        }),
      });
    }

    // Chat
    if (req.method === "POST" && url.pathname === "/chat") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const ip = getClientIp(req, info);

      if (!allow(ip) || !allowSession(sessionId)) {
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
        const messagesToSend = [...recent, steer, { role: "user" as const, content: message }];

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
        if (err instanceof HttpError) {
          return new Response(JSON.stringify({ error: err.message }), { status: err.status, headers: h });
        }
        const safe = redact(String((err as Error)?.message ?? err));
        console.warn("[chat] error:", safe);
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: h });
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
