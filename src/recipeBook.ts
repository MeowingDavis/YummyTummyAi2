import { supabaseAdminRequest } from "./auth.ts";

export type StoredPantryRecipe = {
  id: string;
  spoonacularId: number | null;
  title: string;
  image: string;
  readyInMinutes: number | null;
  servings: number | null;
  summary: string;
  instructions: string;
  ingredients: string[];
  sourceUrl: string;
  spoonacularSourceUrl: string;
  createdAt: number;
  updatedAt: number;
};

export type RecipeBookEntry = {
  id: string;
  createdAt: number;
  updatedAt: number;
  recipe: StoredPantryRecipe;
};

type PantryRecipeRow = {
  id: string;
  spoonacular_id: number | null;
  title: string;
  image: string;
  ready_in_minutes: number | null;
  servings: number | null;
  summary: string;
  instructions: string;
  ingredients: unknown;
  source_url: string;
  spoonacular_source_url: string;
  created_at: string;
  updated_at: string;
};

type RecipeBookRow = {
  id: string;
  user_id: string;
  pantry_recipe_id: string;
  created_at: string;
  updated_at: string;
  pantry_recipe?: PantryRecipeRow;
};

function parseSupabaseTime(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function sanitizeText(input: unknown, max = 12000) {
  return String(input ?? "").trim().slice(0, max);
}

function sanitizeIngredients(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 160);
}

async function requestRows<T>(path: string, options: RequestInit): Promise<T[]> {
  const data = await supabaseAdminRequest(path, options);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Object.keys(data).length) {
    return [data as T];
  }
  return [];
}

function toStoredRecipe(row: PantryRecipeRow | undefined): StoredPantryRecipe | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    spoonacularId: Number(row.spoonacular_id ?? 0) || null,
    title: sanitizeText(row.title, 220),
    image: sanitizeText(row.image, 1200),
    readyInMinutes: Number(row.ready_in_minutes ?? 0) || null,
    servings: Number(row.servings ?? 0) || null,
    summary: sanitizeText(row.summary),
    instructions: sanitizeText(row.instructions),
    ingredients: sanitizeIngredients(row.ingredients),
    sourceUrl: sanitizeText(row.source_url, 2000),
    spoonacularSourceUrl: sanitizeText(row.spoonacular_source_url, 2000),
    createdAt: parseSupabaseTime(row.created_at),
    updatedAt: parseSupabaseTime(row.updated_at),
  };
}

function toEntry(row: RecipeBookRow): RecipeBookEntry | null {
  const recipe = toStoredRecipe(row.pantry_recipe);
  if (!row?.id || !recipe) return null;
  return {
    id: String(row.id),
    createdAt: parseSupabaseTime(row.created_at),
    updatedAt: parseSupabaseTime(row.updated_at),
    recipe,
  };
}

export async function upsertPantryRecipe(detail: {
  spoonacularId?: number | null;
  title: string;
  image?: string;
  readyInMinutes?: number | null;
  servings?: number | null;
  summary?: string;
  instructions?: string;
  ingredients?: string[];
  sourceUrl?: string;
  spoonacularSourceUrl?: string;
}) {
  const rows = await requestRows<PantryRecipeRow>("/rest/v1/pantry_recipes", {
    method: "POST",
    headers: {
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      spoonacular_id: Number(detail.spoonacularId ?? 0) || null,
      title: sanitizeText(detail.title, 220) || "Untitled recipe",
      image: sanitizeText(detail.image, 1200),
      ready_in_minutes: Number(detail.readyInMinutes ?? 0) || null,
      servings: Number(detail.servings ?? 0) || null,
      summary: sanitizeText(detail.summary),
      instructions: sanitizeText(detail.instructions),
      ingredients: sanitizeIngredients(detail.ingredients),
      source_url: sanitizeText(detail.sourceUrl, 2000),
      spoonacular_source_url: sanitizeText(detail.spoonacularSourceUrl, 2000),
    }),
  });

  const stored = toStoredRecipe(rows[0]);
  if (!stored) throw new Error("Unable to store pantry recipe");
  return stored;
}

export async function addRecipeToBook(userId: string, recipeId: string) {
  const rows = await requestRows<RecipeBookRow>("/rest/v1/user_recipe_book", {
    method: "POST",
    headers: {
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      pantry_recipe_id: recipeId,
    }),
  });

  const row = rows[0] ?? (await requestRows<RecipeBookRow>(
    `/rest/v1/user_recipe_book?select=id,user_id,pantry_recipe_id,created_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&pantry_recipe_id=eq.${encodeURIComponent(recipeId)}&limit=1`,
    { method: "GET" },
  ))[0];

  if (!row?.id) throw new Error("Unable to save recipe to book");
  return String(row.id);
}

export async function listRecipeBook(userId: string) {
  const path = `/rest/v1/user_recipe_book?select=id,user_id,pantry_recipe_id,created_at,updated_at,pantry_recipe:pantry_recipe_id(id,spoonacular_id,title,image,ready_in_minutes,servings,summary,instructions,ingredients,source_url,spoonacular_source_url,created_at,updated_at)&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
  const rows = await requestRows<RecipeBookRow>(path, { method: "GET" });
  return rows.map(toEntry).filter((entry): entry is RecipeBookEntry => !!entry);
}

export async function deleteRecipeBookEntry(userId: string, entryId: string) {
  await supabaseAdminRequest(
    `/rest/v1/user_recipe_book?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(entryId)}`,
    { method: "DELETE" },
  );
}
