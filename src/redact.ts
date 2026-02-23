// src/redact.ts

const SENSITIVE = [
  Deno.env.get("GROQ_API_KEY") ?? "",
];

export function redact(text: string) {
  let out = text;
  for (const secret of SENSITIVE) {
    if (!secret) continue;
    out = out.split(secret).join("[REDACTED]");
  }
  return out;
}
