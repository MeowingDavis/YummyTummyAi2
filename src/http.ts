// src/http.ts

const decoder = new TextDecoder();

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readLimitedText(req: Request, limit: number): Promise<string> {
  const len = req.headers.get("content-length");
  if (len !== null) {
    const n = Number(len);
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, "Invalid Content-Length");
    if (n > limit) throw new HttpError(413, "Payload too large");
  }

  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new HttpError(413, "Payload too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (!chunks.length) return "";
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decoder.decode(bytes);
}

export async function readJson<T = unknown>(req: Request, limit = 32 * 1024): Promise<T> {
  const text = await readLimitedText(req, limit);
  if (!text) return {} as T;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
