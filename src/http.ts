// src/http.ts

export async function readJson<T = any>(req: Request, limit = 32 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > limit) throw new Error("Payload too large");
  if (!text) return {} as T;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }
}
