// src/session.ts

const COOKIE_NAME = "yt_sid";
const AUTH_COOKIE_NAME = "yt_auth";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SESSION_SECRET_ENV = Deno.env.get("SESSION_SECRET")?.trim() ?? "";
const NODE_ENV = Deno.env.get("NODE_ENV")?.trim().toLowerCase() ?? "";
const IS_PRODUCTION = NODE_ENV === "production";
// Keep dev usable without extra env setup while requiring explicit secrets in production.
const SESSION_SECRET = SESSION_SECRET_ENV || (IS_PRODUCTION ? "" : crypto.randomUUID());
const COOKIE_SECURE = Deno.env.get("COOKIE_SECURE") === "1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

if (IS_PRODUCTION) {
  if (!SESSION_SECRET_ENV) throw new Error("Missing SESSION_SECRET in production");
  if (!COOKIE_SECURE) throw new Error("COOKIE_SECURE must be set to 1 in production");
}

let signingKeyPromise: Promise<CryptoKey> | null = null;

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + padding);
}

function parseSignedCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match[1]);
    if (raw.length > 2048) return null;
    const dot = raw.lastIndexOf(".");
    if (dot === -1) return null;
    return { value: raw.slice(0, dot), sig: raw.slice(dot + 1) };
  } catch {
    return null;
  }
}

function parseCookieValue(req: Request) {
  const parsed = parseSignedCookie(req, COOKIE_NAME);
  if (!parsed || parsed.value.length > 256) return null;
  return { id: parsed.value, sig: parsed.sig };
}

function shouldSetSecureCookie(req: Request) {
  const proto = new URL(req.url).protocol;
  return COOKIE_SECURE || proto === "https:";
}

export function clearSessionCookie(req: Request) {
  const secure = shouldSetSecureCookie(req) ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function clearAuthCookie(req: Request) {
  const secure = shouldSetSecureCookie(req) ? "; Secure" : "";
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function getSigningKey() {
  if (!signingKeyPromise) {
    signingKeyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  return await signingKeyPromise;
}

async function signSessionId(id: string) {
  const key = await getSigningKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(id));
  return toBase64Url(new Uint8Array(sig));
}

async function hasValidSignature(id: string, sig: string) {
  if (!sig) return false;
  const expected = await signSessionId(id);
  return timingSafeEqual(expected, sig);
}

export async function getOrSetSessionId(req: Request) {
  const parsed = parseCookieValue(req);
  if (parsed && UUID_RE.test(parsed.id) && await hasValidSignature(parsed.id, parsed.sig)) {
    return { id: parsed.id, setCookie: null };
  }

  const id = crypto.randomUUID();
  const sig = await signSessionId(id);
  const value = `${id}.${sig}`;
  const secure = shouldSetSecureCookie(req) ? "; Secure" : "";
  const cookieVal =
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
  return { id, setCookie: cookieVal };
}

type AuthCookieUser = {
  id: string;
  email: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
};

function isValidAuthCookieUser(value: unknown): value is AuthCookieUser {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return UUID_RE.test(String(row.id ?? "").trim()) &&
    typeof row.email === "string" &&
    row.email.trim().length > 0 &&
    Number.isFinite(row.createdAt) &&
    Number.isFinite(row.updatedAt) &&
    (row.name === undefined || typeof row.name === "string");
}

export async function getAuthUserFromCookie(req: Request): Promise<AuthCookieUser | null> {
  const parsed = parseSignedCookie(req, AUTH_COOKIE_NAME);
  if (!parsed || !await hasValidSignature(parsed.value, parsed.sig)) return null;
  try {
    const decoded = fromBase64Url(parsed.value);
    const user = JSON.parse(decoded);
    return isValidAuthCookieUser(user) ? user : null;
  } catch {
    return null;
  }
}

export async function setAuthCookie(req: Request, user: AuthCookieUser) {
  const secure = shouldSetSecureCookie(req) ? "; Secure" : "";
  const payload = toBase64Url(encoder.encode(JSON.stringify(user)));
  const sig = await signSessionId(payload);
  const value = `${payload}.${sig}`;
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}
