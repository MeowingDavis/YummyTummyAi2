export type UserProfile = {
  dietaryRequirements?: string[];
  allergies?: string[];
  dislikes?: string[];
};

export type UserRecord = {
  id: string;
  email: string;
  name?: string;
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
  profile?: UserProfile;
};

export type PublicUser = {
  id: string;
  email: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  profile?: UserProfile;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HASH_ITERATIONS = 210_000;

let kvPromise: Promise<Deno.Kv> | null = null;

function now() {
  return Date.now();
}

async function getKv() {
  if (!kvPromise) kvPromise = Deno.openKv();
  return await kvPromise;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const b64 = input.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((input.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function pbkdf2(password: string, saltBytes: Uint8Array, iterations: number) {
  const salt = saltBytes.buffer.slice(
    saltBytes.byteOffset,
    saltBytes.byteOffset + saltBytes.byteLength,
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, HASH_ITERATIONS);
  return `${HASH_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [itersRaw, saltRaw, hashRaw] = encoded.split("$");
  const iterations = Number(itersRaw);
  if (!Number.isFinite(iterations) || !saltRaw || !hashRaw) return false;
  const salt = fromBase64Url(saltRaw);
  const hash = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(hashRaw, toBase64Url(hash));
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: user.profile,
  };
}

export function validateCredentials(email: string, password: string) {
  const e = normalizeEmail(email);
  if (!EMAIL_RE.test(e)) return "Invalid email";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 256) return "Password too long";
  return null;
}

export async function registerUser(email: string, password: string, name?: string): Promise<PublicUser> {
  const normalized = normalizeEmail(email);
  const kv = await getKv();

  const existing = await kv.get<string>(["usersByEmail", normalized]);
  if (existing.value) throw new Error("EMAIL_TAKEN");

  const id = crypto.randomUUID();
  const createdAt = now();
  const record: UserRecord = {
    id,
    email: normalized,
    name: name?.trim() || undefined,
    passwordHash: await hashPassword(password),
    createdAt,
    updatedAt: createdAt,
    profile: {},
  };

  const res = await kv.atomic()
    .check({ key: ["usersByEmail", normalized], versionstamp: null })
    .set(["usersByEmail", normalized], id)
    .set(["users", id], record)
    .commit();

  if (!res.ok) throw new Error("EMAIL_TAKEN");
  return toPublicUser(record);
}

export async function authenticateUser(email: string, password: string): Promise<PublicUser | null> {
  const normalized = normalizeEmail(email);
  const kv = await getKv();
  const idx = await kv.get<string>(["usersByEmail", normalized]);
  if (!idx.value) return null;

  const row = await kv.get<UserRecord>(["users", idx.value]);
  const user = row.value;
  if (!user) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return toPublicUser(user);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const kv = await getKv();
  const row = await kv.get<UserRecord>(["users", id]);
  if (!row.value) return null;
  return toPublicUser(row.value);
}

export async function linkSessionToUser(sessionId: string, userId: string) {
  const kv = await getKv();
  await kv.set(["sessionUser", sessionId], userId);
}

export async function unlinkSession(sessionId: string) {
  const kv = await getKv();
  await kv.delete(["sessionUser", sessionId]);
}

export async function getUserForSession(sessionId: string): Promise<PublicUser | null> {
  const kv = await getKv();
  const row = await kv.get<string>(["sessionUser", sessionId]);
  if (!row.value) return null;
  return await getUserById(row.value);
}

export async function updateUserProfile(userId: string, patch: UserProfile): Promise<PublicUser | null> {
  const kv = await getKv();
  const row = await kv.get<UserRecord>(["users", userId]);
  if (!row.value) return null;

  const next: UserRecord = {
    ...row.value,
    profile: {
      ...(row.value.profile ?? {}),
      ...(patch ?? {}),
    },
    updatedAt: now(),
  };

  await kv.set(["users", userId], next);
  return toPublicUser(next);
}
