// src/server/templates.ts
import { withSecurity } from "./security.ts";

export function wantsHtml(req: Request, pathname?: string) {
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) return true;
  const path = pathname ?? new URL(req.url).pathname;
  return !path.includes(".") || path.endsWith(".html");
}

export async function serveTextTemplate(
  path: string,
  contentType: string,
  origin: string,
  status = 200,
) {
  try {
    const text = await Deno.readTextFile(path);
    const body = text.replaceAll("{{ORIGIN}}", origin);
    const headers = withSecurity({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    });
    return new Response(body, { status, headers });
  } catch (err) {
    console.warn("[templates] read failed:", String((err as Error)?.message ?? err));
    const headers = withSecurity({ "Content-Type": "text/plain; charset=utf-8" });
    return new Response("Server error", { status: 500, headers });
  }
}

export async function serveErrorPage(code: 404 | 500) {
  const file = code === 404 ? "public/404.html" : "public/500.html";
  try {
    const html = await Deno.readTextFile(file);
    const headers = withSecurity({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    return new Response(html, { status: code, headers });
  } catch {
    const headers = withSecurity({ "Content-Type": "text/plain; charset=utf-8" });
    return new Response(code === 404 ? "Not Found" : "Server Error", { status: code, headers });
  }
}
