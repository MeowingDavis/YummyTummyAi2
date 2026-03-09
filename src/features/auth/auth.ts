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
const LOWER_RE = /[a-z]/;
const UPPER_RE = /[A-Z]/;
const DIGIT_RE = /\d/;
const SYMBOL_RE = /[^A-Za-z0-9]/;
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(
  /\/$/,
  "",
);
const SUPABASE_ANON_KEY = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
const SUPABASE_SERVICE_ROLE_KEY =
  (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

function assertSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase env: SUPABASE_URL and SUPABASE_ANON_KEY are required",
    );
  }
}

function assertSupabaseServiceEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing Supabase env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
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

function toArr(input: unknown) {
  return Array.isArray(input)
    ? input.map((item) => String(item).trim()).filter(Boolean).slice(0, 30)
    : [];
}

function sanitizeProfile(input: unknown): UserProfile {
  if (!input || typeof input !== "object") return {};
  const row = input as Record<string, unknown>;
  return {
    dietaryRequirements: toArr(
      row.dietary_requirements ?? row.dietaryRequirements,
    ),
    allergies: toArr(row.allergies),
    dislikes: toArr(row.dislikes),
  };
}

function toPublicUserFromSupabase(raw: any, profile?: UserProfile): PublicUser {
  return {
    id: String(raw?.id ?? "").trim(),
    email: normalizeEmail(String(raw?.email ?? "")),
    name: raw?.user_metadata?.name
      ? String(raw.user_metadata.name).trim()
      : undefined,
    createdAt: parseSupabaseTime(raw?.created_at),
    updatedAt: parseSupabaseTime(raw?.updated_at),
    profile,
  };
}

async function supabaseRequest(
  path: string,
  options: RequestInit,
  useServiceRole = false,
) {
  if (useServiceRole) {
    assertSupabaseServiceEnv();
  } else {
    assertSupabaseEnv();
  }

  const key = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  const headers = new Headers(options.headers ?? {});
  if (!headers.has("apikey")) headers.set("apikey", key);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${key}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.msg || data?.error_description || data?.error ||
      data?.message ||
      `Supabase auth error (${res.status})`;
    throw new SupabaseApiError(
      res.status,
      String(message),
      typeof data?.code === "string" ? data.code : undefined,
    );
  }
  return data;
}

export async function supabaseAdminRequest(path: string, options: RequestInit) {
  return await supabaseRequest(path, options, true);
}

async function requestRows<T>(
  path: string,
  options: RequestInit,
): Promise<T[]> {
  const data = await supabaseAdminRequest(path, options);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Object.keys(data).length) {
    return [data as T];
  }
  return [];
}

function buildProfilePath(params: Record<string, string | number>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  return `/rest/v1/profiles?${search.toString()}`;
}

export async function getUserProfile(
  userId: string,
): Promise<UserProfile | undefined> {
  const rows = await requestRows<Record<string, unknown>>(
    buildProfilePath({
      select: "dietary_requirements,allergies,dislikes",
      user_id: `eq.${userId}`,
      limit: 1,
    }),
    { method: "GET" },
  );
  const profile = sanitizeProfile(rows[0]);
  if (
    !profile.dietaryRequirements?.length && !profile.allergies?.length &&
    !profile.dislikes?.length
  ) {
    return undefined;
  }
  return profile;
}

export function validatePassword(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 256) return "Password must be 256 characters or fewer.";
  if (!LOWER_RE.test(password)) {
    return "Password must include a lowercase letter.";
  }
  if (!UPPER_RE.test(password)) {
    return "Password must include an uppercase letter.";
  }
  if (!DIGIT_RE.test(password)) return "Password must include a number.";
  if (!SYMBOL_RE.test(password)) {
    return "Password must include a special character.";
  }
  return null;
}

export function validateCredentials(email: string, password: string) {
  const e = normalizeEmail(email);
  if (!EMAIL_RE.test(e)) return "Invalid email.";
  return validatePassword(password);
}

export async function registerUser(
  email: string,
  password: string,
  name?: string,
): Promise<PublicUser> {
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
  return toPublicUserFromSupabase(rawUser);
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const data = await supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: normalizeEmail(email), password }),
  });

  const rawUser = data?.user;
  if (!rawUser) return null;
  const profile = await getUserProfile(String(rawUser.id ?? ""));
  return {
    user: toPublicUserFromSupabase(rawUser, profile),
    emailConfirmed: isEmailConfirmed(rawUser),
  };
}

export async function getUserFromAccessToken(
  accessToken: string,
): Promise<PublicUser | null> {
  const token = accessToken.trim();
  if (!token) return null;
  const rawUser = await supabaseRequest("/auth/v1/user", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!rawUser?.id || !rawUser?.email) return null;
  return toPublicUserFromSupabase(rawUser);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const encodedId = encodeURIComponent(id);
  const data = await supabaseAdminRequest(`/auth/v1/admin/users/${encodedId}`, {
    method: "GET",
  });
  const rawUser = data?.user ?? data;
  if (!rawUser?.id || !rawUser?.email) return null;
  const profile = await getUserProfile(String(rawUser.id));
  return toPublicUserFromSupabase(rawUser, profile);
}

export async function updateUserProfile(
  userId: string,
  patch: UserProfile,
): Promise<PublicUser | null> {
  const current = (await getUserProfile(userId)) ?? {};
  const next: UserProfile = {
    dietaryRequirements: toArr(
      patch.dietaryRequirements ?? current.dietaryRequirements,
    ),
    allergies: toArr(patch.allergies ?? current.allergies),
    dislikes: toArr(patch.dislikes ?? current.dislikes),
  };

  const rows = await requestRows<Record<string, unknown>>("/rest/v1/profiles", {
    method: "POST",
    headers: {
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      dietary_requirements: next.dietaryRequirements ?? [],
      allergies: next.allergies ?? [],
      dislikes: next.dislikes ?? [],
    }),
  });

  const user = await getUserById(userId);
  if (!user) return null;
  return {
    ...user,
    profile: sanitizeProfile(rows[0]),
  };
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
  return /already (registered|in use)|already exists|duplicate|unique/i.test(
    msg,
  );
}

export function isSupabaseRateLimitError(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  const status = err instanceof SupabaseApiError ? err.status : 0;
  return status === 429 ||
    /rate limit|too many requests|over_email_send_rate_limit/i.test(msg);
}

export function isSupabaseInvalidCredentialsError(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /invalid login credentials|invalid credentials|invalid grant/i.test(
    msg,
  );
}

export function isSupabaseEmailNotConfirmedError(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /email not confirmed|confirm your email/i.test(msg);
}

export async function sendPasswordRecoveryEmail(
  email: string,
  redirectTo: string,
) {
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
    if (
      isSupabaseInvalidCredentialsError(err) ||
      isSupabaseEmailNotConfirmedError(err)
    ) {
      return false;
    }
    throw err;
  }
}

export async function updateSupabaseUserPassword(
  userId: string,
  newPassword: string,
) {
  const encodedId = encodeURIComponent(userId);
  await supabaseAdminRequest(`/auth/v1/admin/users/${encodedId}`, {
    method: "PUT",
    body: JSON.stringify({ password: newPassword }),
  });
}

export async function deleteSupabaseUser(userId: string) {
  const encodedId = encodeURIComponent(userId);
  try {
    await supabaseAdminRequest(
      `/auth/v1/admin/users/${encodedId}?should_soft_delete=true`,
      {
        method: "DELETE",
      },
    );
    return;
  } catch (err) {
    const status = err instanceof SupabaseApiError ? err.status : 0;
    if (status !== 400 && status !== 404 && status !== 422) throw err;
  }

  await supabaseAdminRequest(`/auth/v1/admin/users/${encodedId}`, {
    method: "DELETE",
  });
}

export async function deleteLocalUserData(userId: string) {
  await supabaseAdminRequest(
    buildProfilePath({
      user_id: `eq.${userId}`,
    }),
    { method: "DELETE" },
  );
}
