// src/session.ts

export function getOrSetSessionId(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)yt_sid=([^;]+)/);
  if (match) return { id: decodeURIComponent(match[1]), setCookie: null };

  const id = crypto.randomUUID();
  const cookieVal = `yt_sid=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
  return { id, setCookie: cookieVal };
}
