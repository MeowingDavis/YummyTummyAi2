// src/server.ts
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { applySecurityHeaders, withSecurity } from "./security.ts";
import { serveErrorPage, serveTextTemplate, wantsHtml } from "./templates.ts";
import { clearSessionCookie, getOrSetSessionId } from "./session.ts";
import { HttpError, readJson } from "./http.ts";
import { allow, allowSession } from "./rateLimit.ts";
import { SYSTEM_PROMPT, OFF_TOPIC_REPLY, INJECTION_REPLY } from "./chat/prompts.ts";
import { ensureHistory, getHistory, pushAndClamp, clearHistory } from "./chat/history.ts";
import { isCookingQuery } from "./chat/guard.ts";
import { detectMode, steerForMode } from "./chat/modes.ts";
import { groqChat, listGroqModels } from "./chat/groq.ts";
import { detectPromptInjection } from "./chat/injection.ts";
import { redact } from "./redact.ts";
import { buildRecipeContext, hasStrongRecipeMatch, retrieveRecipes } from "./rag/retrieve.ts";
import { buildApiNinjasContext, fetchApiNinjasRecipes, hasApiNinjasConfigured } from "./rag/apiNinjas.ts";
import type { Msg } from "./chat/history.ts";
import { getAppKv } from "./kv.ts";
import {
  SupabaseApiError,
  authenticateUser,
  deleteLocalUserData,
  deleteSupabaseUser,
  getPublicSupabaseConfig,
  getUserForSession,
  isSupabaseAlreadyRegisteredError,
  isSupabaseEmailNotConfirmedError,
  isSupabaseInvalidCredentialsError,
  isSupabaseRateLimitError,
  linkSessionToUser,
  registerUser,
  sendPasswordRecoveryEmail,
  unlinkSession,
  updateSupabaseUserPassword,
  updateUserProfile,
  validateCredentials,
  verifyPassword,
} from "./auth.ts";

const NODE_ENV = Deno.env.get("NODE_ENV")?.trim().toLowerCase() ?? "";
const IS_PRODUCTION = NODE_ENV === "production";
const CANONICAL_ORIGIN = Deno.env.get("CANONICAL_ORIGIN")?.trim() ?? "";
const ALLOWED_HOSTS = new Set(parseCsv(Deno.env.get("ALLOWED_HOSTS")).map(h => h.toLowerCase()));
const TRUSTED_PROXY_IPS = new Set(parseCsv(Deno.env.get("TRUSTED_PROXY_IPS")));
const DEFAULT_MODEL = Deno.env.get("MODEL")?.trim() || "llama-3.1-8b-instant";
const CONFIGURED_MODELS = (() => {
  const csv = parseCsv(Deno.env.get("GROQ_MODELS"));
  return csv.length ? csv : [DEFAULT_MODEL];
})();
const IP_RE = /^[0-9a-fA-F:.]+$/;
const CANONICAL_URL = parseCanonicalOrigin(CANONICAL_ORIGIN);
const MAX_SAVED_CHATS = 50;
const MAX_CHAT_TITLE = 120;
const MODELS_REFRESH_MS = 5 * 60 * 1000;
const CHAT_WINDOW_MS = 24 * 60 * 60 * 1000;
const GUEST_DAILY_CHAT_LIMIT = 15;
const USER_DAILY_CHAT_LIMIT = 40;

type SavedChat = {
  id: string;
  title: string;
  history: Msg[];
  createdAt: number;
  updatedAt: number;
};

type ChatQuotaState = {
  timestamps: number[];
  updatedAt: number;
};

let modelResolutionCache: { at: number; models: string[]; defaultModel: string } | null = null;

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

async function resolveAllowedModels() {
  const now = Date.now();
  if (modelResolutionCache && now - modelResolutionCache.at < MODELS_REFRESH_MS) {
    return modelResolutionCache;
  }

  let models = [...CONFIGURED_MODELS];
  try {
    const available = new Set(await listGroqModels());
    const filtered = models.filter(m => available.has(m));
    if (filtered.length) models = filtered;
  } catch (err) {
    console.warn("[models] live model fetch failed, using configured list:", redact(String((err as Error)?.message ?? err)));
  }

  const defaultModel = models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0] || DEFAULT_MODEL;
  const resolved = { at: now, models, defaultModel };
  modelResolutionCache = resolved;
  return resolved;
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

function getPasswordResetRedirect(url: URL) {
  const host = url.hostname.toLowerCase();
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  const origin = isLocalHost ? url.origin : publicOrigin(url);
  return `${origin}/reset-password.html`;
}

function chatOwnerKey(sessionId: string, userId?: string) {
  return userId ? `user:${userId}` : `session:${sessionId}`;
}

async function getKv() {
  return await getAppKv();
}

function sanitizeHistory(input: unknown): Msg[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const role = (row as { role?: string }).role;
      const content = (row as { content?: unknown }).content;
      if ((role !== "system" && role !== "user" && role !== "assistant") || typeof content !== "string") return null;
      return { role, content: content.trim() } as Msg;
    })
    .filter((m): m is Msg => !!m && !!m.content)
    .slice(-200);
}

async function listSavedChats(ownerKey: string) {
  const kv = await getKv();
  const items: SavedChat[] = [];
  for await (const e of kv.list<SavedChat>({ prefix: ["savedChats", ownerKey] })) {
    if (e.value) items.push(e.value);
  }
  items.sort((a, b) => b.updatedAt - a.updatedAt);
  return items;
}

function limitForUser(userId?: string) {
  return userId ? USER_DAILY_CHAT_LIMIT : GUEST_DAILY_CHAT_LIMIT;
}

function isControlNewChat(message: string, newChat?: boolean) {
  if (!newChat) return false;
  return /^let'?s start a new chat!?$/i.test(message.trim());
}

async function consumeDailyChatQuota(sessionId: string, userId?: string) {
  const kv = await getKv();
  const quotaOwner = userId ? `user:${userId}` : `session:${sessionId}`;
  const key = ["chatQuota", quotaOwner];
  const now = Date.now();
  const limit = limitForUser(userId);

  const row = await kv.get<ChatQuotaState>(key);
  const prior = Array.isArray(row.value?.timestamps)
    ? row.value.timestamps.filter((ts): ts is number => Number.isFinite(ts) && ts > 0)
    : [];
  const kept = prior
    .filter(ts => now - ts < CHAT_WINDOW_MS)
    .sort((a, b) => a - b)
    .slice(-limit);

  if (kept.length >= limit) {
    await kv.set(key, { timestamps: kept, updatedAt: now });
    const oldest = kept[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((CHAT_WINDOW_MS - (now - oldest)) / 1000));
    return { allowed: false as const, limit, remaining: 0, retryAfterSec };
  }

  kept.push(now);
  await kv.set(key, { timestamps: kept, updatedAt: now });
  return { allowed: true as const, limit, remaining: Math.max(0, limit - kept.length), retryAfterSec: 0 };
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

    // Available chat models for the UI model picker
    if (req.method === "GET" && url.pathname === "/chat-models") {
      const { setCookie } = await getOrSetSessionId(req);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      const resolved = await resolveAllowedModels();
      return new Response(JSON.stringify({
        defaultModel: resolved.defaultModel,
        models: resolved.models,
      }), { headers: h });
    }

    // Auth
    if (req.method === "GET" && url.pathname === "/me") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const user = await getUserForSession(sessionId);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      return new Response(JSON.stringify({ user }), { headers: h });
    }
    if (req.method === "POST" && url.pathname === "/auth/register") {
      const { setCookie } = await getOrSetSessionId(req);
      try {
        const body = await readJson<{ email?: string; password?: string; name?: string }>(req);
        const email = (body.email ?? "").trim();
        const password = String(body.password ?? "");
        const err = validateCredentials(email, password);
        if (err) {
          const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
          if (setCookie) h.append("Set-Cookie", setCookie);
          return new Response(JSON.stringify({ error: err }), { status: 400, headers: h });
        }
        await registerUser(email, password, body.name);
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        return new Response(JSON.stringify({
          ok: true,
          confirmationRequired: true,
        }), { status: 201, headers: h });
      } catch (err) {
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        if (isSupabaseAlreadyRegisteredError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "EMAIL_ALREADY_EXISTS",
            message: "An account with this email already exists. Try logging in.",
          }), { status: 409, headers: h });
        }
        if (isSupabaseRateLimitError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "RATE_LIMITED",
            message: "Too many attempts. Please wait and try again.",
          }), { status: 429, headers: h });
        }
        // Log unexpected errors server-side without exposing internal details to the client.
        console.error("Unexpected error during /auth/register:", err);
        return new Response(JSON.stringify({
          ok: false,
          code: "REGISTER_FAILED",
          message: "Server error",
        }), { status: 500, headers: h });
      }
    }
    if (req.method === "POST" && url.pathname === "/auth/login") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      try {
        const body = await readJson<{ email?: string; password?: string }>(req);
        const email = (body.email ?? "").trim();
        const password = String(body.password ?? "");
        if (!email || !password) {
          const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
          if (setCookie) h.append("Set-Cookie", setCookie);
          return new Response(JSON.stringify({
            ok: false,
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          }), { status: 401, headers: h });
        }

        const login = await authenticateUser(email, password);
        if (!login) {
          const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
          if (setCookie) h.append("Set-Cookie", setCookie);
          return new Response(JSON.stringify({
            ok: false,
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          }), { status: 401, headers: h });
        }
        if (!login.emailConfirmed) {
          const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
          if (setCookie) h.append("Set-Cookie", setCookie);
          return new Response(JSON.stringify({
            ok: false,
            code: "EMAIL_NOT_CONFIRMED",
            message: "Please confirm your email before logging in.",
          }), { status: 401, headers: h });
        }
        await linkSessionToUser(sessionId, login.user.id);
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        return new Response(JSON.stringify({ ok: true, user: login.user }), { headers: h });
      } catch (err) {
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        if (isSupabaseEmailNotConfirmedError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "EMAIL_NOT_CONFIRMED",
            message: "Please confirm your email before logging in.",
          }), { status: 401, headers: h });
        }
        if (isSupabaseInvalidCredentialsError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          }), { status: 401, headers: h });
        }
        if (isSupabaseRateLimitError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "RATE_LIMITED",
            message: "Too many attempts. Please wait and try again.",
          }), { status: 429, headers: h });
        }
        // Log unexpected errors server-side without exposing internal details to the client.
        console.error("Unexpected error during /auth/login:", err);
        return new Response(JSON.stringify({
          ok: false,
          code: "LOGIN_FAILED",
          message: "Server error",
        }), { status: 500, headers: h });
      }
    }
    if (req.method === "POST" && url.pathname === "/auth/forgot-password") {
      const { setCookie } = await getOrSetSessionId(req);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      try {
        const body = await readJson<{ email?: string }>(req);
        const email = (body.email ?? "").trim();
        if (!email) {
          return new Response(JSON.stringify({ ok: true }), { headers: h });
        }
        await sendPasswordRecoveryEmail(email, getPasswordResetRedirect(url));
        return new Response(JSON.stringify({ ok: true }), { headers: h });
      } catch (err) {
        if (isSupabaseRateLimitError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "RATE_LIMITED",
            message: "Too many requests. Please wait and try again.",
          }), { status: 429, headers: h });
        }
        if (err instanceof SupabaseApiError && err.status >= 400 && err.status < 500) {
          return new Response(JSON.stringify({ ok: true }), { headers: h });
        }
        return new Response(JSON.stringify({
          ok: false,
          code: "FORGOT_PASSWORD_FAILED",
          message: "Unable to send reset email right now.",
        }), { status: 502, headers: h });
      }
    }
    if (req.method === "GET" && url.pathname === "/auth/client-config") {
      const { setCookie } = await getOrSetSessionId(req);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      try {
        const conf = getPublicSupabaseConfig();
        return new Response(JSON.stringify({
          ok: true,
          supabaseUrl: conf.url,
          supabaseAnonKey: conf.anonKey,
        }), { headers: h });
      } catch {
        return new Response(JSON.stringify({
          ok: false,
          message: "Supabase configuration unavailable.",
        }), { status: 500, headers: h });
      }
    }
    if (req.method === "POST" && url.pathname === "/auth/logout") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      await unlinkSession(sessionId);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      return new Response(JSON.stringify({ ok: true }), { headers: h });
    }
    if (req.method === "POST" && url.pathname === "/auth/change-password") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const user = await getUserForSession(sessionId);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      if (!user) {
        return new Response(JSON.stringify({
          ok: false,
          code: "UNAUTHORIZED",
          message: "Please log in.",
        }), { status: 401, headers: h });
      }
      try {
        const body = await readJson<{ currentPassword?: string; newPassword?: string }>(req);
        const currentPassword = String(body.currentPassword ?? "");
        const newPassword = String(body.newPassword ?? "");
        if (!currentPassword) {
          return new Response(JSON.stringify({
            ok: false,
            code: "PASSWORD_REQUIRED",
            message: "Current password is required.",
          }), { status: 400, headers: h });
        }
        if (newPassword.length < 8) {
          return new Response(JSON.stringify({
            ok: false,
            code: "NEW_PASSWORD_INVALID",
            message: "New password must be at least 8 characters.",
          }), { status: 400, headers: h });
        }
        if (newPassword.length > 256) {
          return new Response(JSON.stringify({
            ok: false,
            code: "NEW_PASSWORD_INVALID",
            message: "New password is too long.",
          }), { status: 400, headers: h });
        }
        if (currentPassword === newPassword) {
          return new Response(JSON.stringify({
            ok: false,
            code: "PASSWORD_REUSE",
            message: "New password must be different from current password.",
          }), { status: 400, headers: h });
        }

        const passwordOk = await verifyPassword(user.email, currentPassword);
        if (!passwordOk) {
          return new Response(JSON.stringify({
            ok: false,
            code: "INVALID_PASSWORD",
            message: "Current password is incorrect.",
          }), { status: 401, headers: h });
        }

        await updateSupabaseUserPassword(user.id, newPassword);
        return new Response(JSON.stringify({ ok: true }), { headers: h });
      } catch (err) {
        if (isSupabaseInvalidCredentialsError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "INVALID_PASSWORD",
            message: "Current password is incorrect.",
          }), { status: 401, headers: h });
        }
        if (isSupabaseRateLimitError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "RATE_LIMITED",
            message: "Too many attempts. Please wait and try again.",
          }), { status: 429, headers: h });
        }
        return new Response(JSON.stringify({
          ok: false,
          code: "CHANGE_PASSWORD_FAILED",
          message: "Unable to change password right now.",
        }), { status: 500, headers: h });
      }
    }
    if (req.method === "POST" && url.pathname === "/auth/delete-account") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const user = await getUserForSession(sessionId);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      if (!user) {
        return new Response(JSON.stringify({
          ok: false,
          code: "UNAUTHORIZED",
          message: "Please log in.",
        }), { status: 401, headers: h });
      }
      try {
        const body = await readJson<{ password?: string }>(req);
        const password = String(body.password ?? "");
        if (!password) {
          return new Response(JSON.stringify({
            ok: false,
            code: "PASSWORD_REQUIRED",
            message: "Password is required.",
          }), { status: 400, headers: h });
        }

        const passwordOk = await verifyPassword(user.email, password);
        if (!passwordOk) {
          return new Response(JSON.stringify({
            ok: false,
            code: "INVALID_PASSWORD",
            message: "Incorrect password.",
          }), { status: 401, headers: h });
        }

        await deleteSupabaseUser(user.id);
        await deleteLocalUserData(user.id);
        await unlinkSession(sessionId);

        const kv = await getKv();
        const owner = chatOwnerKey(sessionId, user.id);
        for await (const e of kv.list({ prefix: ["savedChats", owner] })) {
          await kv.delete(e.key);
        }
        await kv.delete(["chatHistory", owner]);
        await kv.delete(["chatQuota", `user:${user.id}`]);

        const successHeaders = new Headers(withSecurity({ "Content-Type": "application/json" }));
        successHeaders.append("Set-Cookie", clearSessionCookie(req));
        return new Response(JSON.stringify({ ok: true }), { headers: successHeaders });
      } catch (err) {
        if (isSupabaseInvalidCredentialsError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "INVALID_PASSWORD",
            message: "Incorrect password.",
          }), { status: 401, headers: h });
        }
        if (isSupabaseRateLimitError(err)) {
          return new Response(JSON.stringify({
            ok: false,
            code: "RATE_LIMITED",
            message: "Too many attempts. Please wait and try again.",
          }), { status: 429, headers: h });
        }
        return new Response(JSON.stringify({
          ok: false,
          code: "DELETE_ACCOUNT_FAILED",
          message: "Unable to delete account right now.",
        }), { status: 500, headers: h });
      }
    }
    if (req.method === "PATCH" && url.pathname === "/me/profile") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const user = await getUserForSession(sessionId);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: h });
      }
      try {
        const body = await readJson<{ dietaryRequirements?: string[]; allergies?: string[]; dislikes?: string[] }>(req);
        const toArr = (v: unknown) => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean).slice(0, 30) : [];
        const updated = await updateUserProfile(user.id, {
          dietaryRequirements: toArr(body.dietaryRequirements),
          allergies: toArr(body.allergies),
          dislikes: toArr(body.dislikes),
        });
        return new Response(JSON.stringify({ user: updated }), { headers: h });
      } catch (err) {
        if (err instanceof HttpError) {
          return new Response(JSON.stringify({ error: err.message }), { status: err.status, headers: h });
        }
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: h });
      }
    }

    // Saved chats (session-scoped in Deno KV)
    if (req.method === "GET" && url.pathname === "/saved-chats") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      const user = await getUserForSession(sessionId);
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: h });
      const chats = await listSavedChats(chatOwnerKey(sessionId, user.id));
      return new Response(JSON.stringify({ chats }), { headers: h });
    }
    if (req.method === "POST" && url.pathname === "/saved-chats") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const user = await getUserForSession(sessionId);
      const ownerKey = chatOwnerKey(sessionId, user?.id);
      try {
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        if (!user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: h });
        }
        const body = await readJson<{ title?: string; history?: unknown }>(req);
        const title = (body.title ?? "").trim().slice(0, MAX_CHAT_TITLE);
        const history = sanitizeHistory(body.history);
        if (!title || !history.length) {
          return new Response(JSON.stringify({ error: "title and history are required" }), { status: 400, headers: h });
        }

        const kv = await getKv();
        const existing = await listSavedChats(ownerKey);
        if (existing.length >= MAX_SAVED_CHATS) {
          const oldest = existing[existing.length - 1];
          await kv.delete(["savedChats", ownerKey, oldest.id]);
        }

        const now = Date.now();
        const saved: SavedChat = {
          id: crypto.randomUUID(),
          title,
          history,
          createdAt: now,
          updatedAt: now,
        };
        await kv.set(["savedChats", ownerKey, saved.id], saved);
        return new Response(JSON.stringify({ chat: saved }), { status: 201, headers: h });
      } catch (err) {
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        if (err instanceof HttpError) {
          return new Response(JSON.stringify({ error: err.message }), { status: err.status, headers: h });
        }
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: h });
      }
    }
    if (req.method === "GET" && url.pathname.startsWith("/saved-chats/")) {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const id = decodeURIComponent(url.pathname.replace("/saved-chats/", ""));
      const kv = await getKv();
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      const user = await getUserForSession(sessionId);
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: h });
      const found = await kv.get<SavedChat>(["savedChats", chatOwnerKey(sessionId, user.id), id]);
      if (!found.value) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: h });
      }
      return new Response(JSON.stringify({ chat: found.value }), { headers: h });
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/saved-chats/")) {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const id = decodeURIComponent(url.pathname.replace("/saved-chats/", ""));
      const user = await getUserForSession(sessionId);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      if (setCookie) h.append("Set-Cookie", setCookie);
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: h });
      const kv = await getKv();
      await kv.delete(["savedChats", chatOwnerKey(sessionId, user.id), id]);
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
    if (req.method === "GET" && (url.pathname === "/auth" || url.pathname === "/auth/")) {
      return new Response(null, {
        status: 307,
        headers: withSecurity({
          "Location": "/auth.html",
          "Cache-Control": "no-store",
        }),
      });
    }
    if (req.method === "GET" && (url.pathname === "/forgot-password" || url.pathname === "/forgot-password/")) {
      return new Response(null, {
        status: 307,
        headers: withSecurity({
          "Location": "/forgot-password.html",
          "Cache-Control": "no-store",
        }),
      });
    }
    if (req.method === "GET" && (url.pathname === "/reset-password" || url.pathname === "/reset-password/")) {
      return new Response(null, {
        status: 307,
        headers: withSecurity({
          "Location": "/reset-password.html",
          "Cache-Control": "no-store",
        }),
      });
    }
    if (req.method === "GET" && (url.pathname === "/account" || url.pathname === "/account/")) {
      return new Response(null, {
        status: 307,
        headers: withSecurity({
          "Location": "/account.html",
          "Cache-Control": "no-store",
        }),
      });
    }

    // Chat
    if (req.method === "POST" && url.pathname === "/chat") {
      const { id: sessionId, setCookie } = await getOrSetSessionId(req);
      const ip = getClientIp(req, info);
      const user = await getUserForSession(sessionId);
      const ownerKey = chatOwnerKey(sessionId, user?.id);

      if (!allow(ip) || !allowSession(sessionId)) {
        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: h });
      }

      try {
        const body = await readJson<{ message?: string; newChat?: boolean; model?: string }>(req);
        const message = (body.message ?? "").trim();
        const selectedModel = (body.model ?? "").trim();
        const isNewChatControl = isControlNewChat(message, body.newChat);
        const resolvedModels = await resolveAllowedModels();
        const allowedModels = new Set(resolvedModels.models);
        const chosenModel = selectedModel && allowedModels.has(selectedModel)
          ? selectedModel
          : resolvedModels.defaultModel;

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
        if (!isNewChatControl) {
          const quota = await consumeDailyChatQuota(sessionId, user?.id);
          if (!quota.allowed) {
            const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
            if (setCookie) h.append("Set-Cookie", setCookie);
            h.set("Retry-After", String(quota.retryAfterSec));
            const error = user
              ? `Daily chat limit reached (${quota.limit}/24h). Please try again later.`
              : `Daily guest chat limit reached (${quota.limit}/24h). Sign up to unlock ${USER_DAILY_CHAT_LIMIT}/24h.`;
            return new Response(JSON.stringify({
              error,
              limit: quota.limit,
              remaining: quota.remaining,
              retryAfterSec: quota.retryAfterSec,
            }), { status: 429, headers: h });
          }
        }

        // Prompt-injection guard
        const injection = await detectPromptInjection(message);
        if (injection.violation === 1) {
          const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
          if (setCookie) h.append("Set-Cookie", setCookie);
          return new Response(JSON.stringify({
            reply: INJECTION_REPLY,
            markdown: INJECTION_REPLY,
            blocked: true,
            blockReason: injection.category,
          }), { headers: h });
        }

        if (body.newChat) await clearHistory(ownerKey);
        await ensureHistory(ownerKey, SYSTEM_PROMPT);

        const history = await getHistory(ownerKey);
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

        // Retrieve recipe context (RAG-lite from local recipe corpus)
        const recipeHits = await retrieveRecipes(message, 3);
        const recipeContext = buildRecipeContext(recipeHits);
        const strongRecipeMatch = hasStrongRecipeMatch(recipeHits);
        let apiNinjasContext = "";
        if (!strongRecipeMatch && hasApiNinjasConfigured()) {
          try {
            const apiNinjasRecipes = await fetchApiNinjasRecipes(message, 2);
            apiNinjasContext = buildApiNinjasContext(apiNinjasRecipes);
          } catch (err) {
            const safe = redact(String((err as Error)?.message ?? err));
            console.warn("[api-ninjas] recipe lookup failed:", safe);
          }
        }
        const profile = user?.profile;
        const profileSteer = profile
          ? [
              "Apply user profile preferences when generating food responses:",
              `dietaryRequirements: ${(profile.dietaryRequirements ?? []).join(", ") || "none"}`,
              `allergies: ${(profile.allergies ?? []).join(", ") || "none"}`,
              `dislikes: ${(profile.dislikes ?? []).join(", ") || "none"}`,
            ].join("\n")
          : "";
        const ragSteer = {
          role: "system" as const,
          content: strongRecipeMatch
            ? "Use the recipe library context when it fits the request. Prefer those recipes and mention recipe title(s) used."
            : apiNinjasContext
            ? "No strong local recipe-library match found. Use API recipe matches when relevant and mention recipe title(s) used."
            : "No strong recipe-library match found. You may create a fresh recipe while following user constraints.",
        };

        // Build request to model
        const recent = history.slice(-12);
        const messagesToSend = [
          ...recent,
          steer,
          ...(profileSteer ? [{ role: "system" as const, content: profileSteer }] : []),
          ...(recipeContext ? [{ role: "system" as const, content: recipeContext }] : []),
          ...(apiNinjasContext ? [{ role: "system" as const, content: apiNinjasContext }] : []),
          ragSteer,
          { role: "user" as const, content: message },
        ];

        // Call model
        await pushAndClamp(ownerKey, { role: "user", content: message });
        const reply = await groqChat(messagesToSend, chosenModel);
        await pushAndClamp(ownerKey, { role: "assistant", content: reply });

        const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
        if (setCookie) h.append("Set-Cookie", setCookie);
        return new Response(JSON.stringify({
          reply,
          markdown: reply,
          modelUsed: chosenModel,
          modelFallback: !!selectedModel && selectedModel !== chosenModel,
        }), { headers: h });
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
      } else if (ct.includes("javascript") || ct.includes("css") || ct.includes("json")) {
        // Assets are not fingerprinted; avoid long-lived immutable caching.
        h.set("Cache-Control", "public, max-age=60, must-revalidate");
      } else if (ct.includes("image") || ct.includes("font") || ct.includes("webmanifest")) {
        h.set("Cache-Control", "public, max-age=86400");
      }

      return new Response(res.body, { status: res.status, headers: h });
    } catch {
      if (wantsHtml(req, url.pathname)) return await serveErrorPage(500);
      const h = new Headers(withSecurity({ "Content-Type": "application/json" }));
      return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: h });
    }
  });
}
