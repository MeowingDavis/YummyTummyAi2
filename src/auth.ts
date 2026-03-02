export type UserProfile = {
  dietaryRequirements?: string[];
  allergies?: string[];
  dislikes?: string[];
};

export type PublicUser = {
  id: string;
  email: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  profile?: UserProfile;
};

type StoredUser = {
  id: string;
  email: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/$/, "");
const SUPABASE_ANON_KEY = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();

let kvPromise: Promise<Deno.Kv> | null = null;

function assertSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase env: SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
}

async function getKv() {
  if (!kvPromise) kvPromise = Deno.openKv();
  return await kvPromise;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseSupabaseTime(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function toStoredUserFromSupabase(raw: any): StoredUser {
  const id = String(raw?.id ?? "").trim();
  const email = normalizeEmail(String(raw?.email ?? ""));
  const name = raw?.user_metadata?.name ? String(raw.user_metadata.name).trim() : undefined;
  return {
    id,
    email,
    name,
    createdAt: parseSupabaseTime(raw?.created_at),
    updatedAt: parseSupabaseTime(raw?.updated_at),
  };
}

async function supabaseRequest(path: string, options: RequestInit) {
  assertSupabaseEnv();
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.msg || data?.error_description || data?.error || `Supabase auth error (${res.status})`;
    throw new Error(String(message));
  }
  return data;
}

async function upsertUser(user: StoredUser) {
  if (!user.id || !user.email) throw new Error("Invalid Supabase user payload");
  const kv = await getKv();
  await kv.set(["users", user.id], user);
}

async function getStoredUser(userId: string): Promise<StoredUser | null> {
  const kv = await getKv();
  const row = await kv.get<StoredUser>(["users", userId]);
  return row.value ?? null;
}

async function getProfile(userId: string): Promise<UserProfile | undefined> {
  const kv = await getKv();
  const row = await kv.get<UserProfile>(["profiles", userId]);
  return row.value ?? undefined;
}

async function toPublicUser(stored: StoredUser): Promise<PublicUser> {
  return {
    ...stored,
    profile: await getProfile(stored.id),
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
  const payload: Record<string, unknown> = {
    email: normalizeEmail(email),
    password,
  };
  if (name?.trim()) payload.data = { name: name.trim() };

  const data = await supabaseRequest("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const rawUser = data?.user;
  if (!rawUser) throw new Error("Supabase did not return a user");
  const stored = toStoredUserFromSupabase(rawUser);
  await upsertUser(stored);
  return await toPublicUser(stored);
}

export async function authenticateUser(email: string, password: string): Promise<PublicUser | null> {
  const data = await supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: normalizeEmail(email), password }),
  });

  const rawUser = data?.user;
  if (!rawUser) return null;
  const stored = toStoredUserFromSupabase(rawUser);
  await upsertUser(stored);
  return await toPublicUser(stored);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const stored = await getStoredUser(id);
  if (!stored) return null;
  return await toPublicUser(stored);
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
  const stored = await getStoredUser(userId);
  if (!stored) return null;

  const current = (await getProfile(userId)) ?? {};
  const next: UserProfile = {
    ...current,
    ...patch,
  };

  const kv = await getKv();
  await kv.set(["profiles", userId], next);
  return await toPublicUser(stored);
}
