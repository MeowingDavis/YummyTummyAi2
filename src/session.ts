// src/session.ts

const COOKIE_NAME = "yt_sid";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SESSION_SECRET = Deno.env.get("SESSION_SECRET")?.trim() ?? "";
const COOKIE_SECURE = Deno.env.get("COOKIE_SECURE") === "1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

let signingKeyPromise: Promise<CryptoKey | null> | null = null;

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

function parseCookieValue(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match[1]);
    if (raw.length > 256) return null;
    const dot = raw.indexOf(".");
    if (dot === -1) return { id: raw, sig: "" };
    return { id: raw.slice(0, dot), sig: raw.slice(dot + 1) };
  } catch {
    return null;
  }
}

function shouldSetSecureCookie(req: Request) {
  const proto = new URL(req.url).protocol;
  return COOKIE_SECURE || proto === "https:";
}

async function getSigningKey() {
  if (!SESSION_SECRET) return null;
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
  if (!key) return "";
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(id));
  return toBase64Url(new Uint8Array(sig));
}

async function hasValidSignature(id: string, sig: string) {
  if (!sig) return false;
  const expected = await signSessionId(id);
  if (!expected) return false;
  return timingSafeEqual(expected, sig);
}

export async function getOrSetSessionId(req: Request) {
  const parsed = parseCookieValue(req);
  if (parsed && UUID_RE.test(parsed.id)) {
    const key = await getSigningKey();
    if (!key || await hasValidSignature(parsed.id, parsed.sig)) {
      return { id: parsed.id, setCookie: null };
    }
  }

  const id = crypto.randomUUID();
  const sig = await signSessionId(id);
  const value = sig ? `${id}.${sig}` : id;
  const secure = shouldSetSecureCookie(req) ? "; Secure" : "";
  const cookieVal =
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
  return { id, setCookie: cookieVal };
}
