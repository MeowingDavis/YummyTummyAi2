import { getAppKv } from "./kv.ts";

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

export type AuthenticatedUser = {
  user: PublicUser;
  emailConfirmed: boolean;
};

export class SupabaseApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/$/, "");
const SUPABASE_ANON_KEY = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

function assertSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase env: SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
}

async function getKv() {
  return await getAppKv();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseSupabaseTime(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function isEmailConfirmed(raw: any) {
  const value = raw?.email_confirmed_at ?? raw?.confirmed_at;
  return typeof value === "string" && value.trim().length > 0;
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

async function supabaseRequest(path: string, options: RequestInit, useServiceRole = false) {
  if (useServiceRole) {
    assertSupabaseServiceEnv();
  } else {
    assertSupabaseEnv();
  }

  const key = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  const headers = new Headers(options.headers ?? {});
  if (!headers.has("apikey")) headers.set("apikey", key);
  if (useServiceRole && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${key}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.msg || data?.error_description || data?.error || data?.message ||
      `Supabase auth error (${res.status})`;
    throw new SupabaseApiError(res.status, String(message), typeof data?.code === "string" ? data.code : undefined);
  }
  return data;
}

export async function supabaseAdminRequest(path: string, options: RequestInit) {
  return await supabaseRequest(path, options, true);
}

function assertSupabaseServiceEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
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

export async function authenticateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
  const data = await supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: normalizeEmail(email), password }),
  });

  const rawUser = data?.user;
  if (!rawUser) return null;
  const stored = toStoredUserFromSupabase(rawUser);
  await upsertUser(stored);
  return {
    user: await toPublicUser(stored),
    emailConfirmed: isEmailConfirmed(rawUser),
  };
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

export function getPublicSupabaseConfig() {
  assertSupabaseEnv();
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  };
}

export function isSupabaseAlreadyRegisteredError(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /already (registered|in use)|already exists|duplicate|unique/i.test(msg);
}

export function isSupabaseRateLimitError(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  const status = err instanceof SupabaseApiError ? err.status : 0;
  return status === 429 || /rate limit|too many requests|over_email_send_rate_limit/i.test(msg);
}

export function isSupabaseInvalidCredentialsError(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /invalid login credentials|invalid credentials|invalid grant/i.test(msg);
}

export function isSupabaseEmailNotConfirmedError(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /email not confirmed|confirm your email/i.test(msg);
}

export async function sendPasswordRecoveryEmail(email: string, redirectTo: string) {
  await supabaseRequest("/auth/v1/recover", {
    method: "POST",
    body: JSON.stringify({
      email: normalizeEmail(email),
      redirect_to: redirectTo,
    }),
  });
}

export async function verifyPassword(email: string, password: string) {
  try {
    await supabaseRequest("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: normalizeEmail(email), password }),
    });
    return true;
  } catch (err) {
    if (isSupabaseInvalidCredentialsError(err) || isSupabaseEmailNotConfirmedError(err)) {
      return false;
    }
    throw err;
  }
}

export async function updateSupabaseUserPassword(userId: string, newPassword: string) {
  const encodedId = encodeURIComponent(userId);
  await supabaseRequest(`/auth/v1/admin/users/${encodedId}`, {
    method: "PUT",
    body: JSON.stringify({ password: newPassword }),
  }, true);
}

export async function deleteSupabaseUser(userId: string) {
  const encodedId = encodeURIComponent(userId);
  try {
    await supabaseRequest(`/auth/v1/admin/users/${encodedId}?should_soft_delete=true`, {
      method: "DELETE",
    }, true);
    return;
  } catch (err) {
    const status = err instanceof SupabaseApiError ? err.status : 0;
    if (status !== 400 && status !== 404 && status !== 422) throw err;
  }

  await supabaseRequest(`/auth/v1/admin/users/${encodedId}`, {
    method: "DELETE",
  }, true);
}

export async function deleteLocalUserData(userId: string) {
  const kv = await getKv();
  await kv.delete(["users", userId]);
  await kv.delete(["profiles", userId]);
}
