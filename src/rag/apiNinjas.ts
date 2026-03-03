type ApiNinjasRecipe = {
  title: string;
  ingredients: string[];
  instructions: string;
  servings?: string;
};

type CacheEntry = {
  at: number;
  items: ApiNinjasRecipe[];
};

const API_NINJAS_API_KEY = (Deno.env.get("API_NINJAS_API_KEY") ?? "").trim();
const API_NINJAS_URLS = [
  "https://api.api-ninjas.com/v2/recipe",
  "https://api.api-ninjas.com/v3/recipe",
  "https://api-ninjas.com/v3/recipe",
];
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIngredientQuery(message: string): string[] {
  const raw = normalizeText(message);
  if (!raw) return [];

  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  const marker = raw.match(/(?:with|using|from)\s+(.+)$/i);
  if (!marker) return [];
  return marker[1]
    .split(/,| and /g)
    .map((v) => v.trim())
    .filter((v) => v.length > 1)
    .slice(0, 6);
}

function buildSearchParams(message: string) {
  const params = new URLSearchParams();
  const ingredients = parseIngredientQuery(message);
  // v3 docs indicate `ingredients` is premium-only, so default to title-based search
  // for broad compatibility across API Ninjas plans.
  const title = (ingredients.length >= 2 ? ingredients.join(" ") : normalizeText(message)).slice(0, 80);
  if (title) params.set("title", title);
  return params;
}

function toRecipe(raw: unknown): ApiNinjasRecipe | null {
  const obj = raw as Record<string, unknown>;
  const title = String(obj?.title ?? "").trim();
  const rawInstructions = obj?.instructions;
  const instructions = Array.isArray(rawInstructions)
    ? rawInstructions.map((v) => String(v).trim()).filter(Boolean).join(" | ")
    : String(rawInstructions ?? "").trim();
  const servings = String(obj?.servings ?? "").trim() || undefined;
  const rawIngredients = obj?.ingredients;
  const ingredients = Array.isArray(rawIngredients)
    ? rawIngredients.map((v) => String(v).trim()).filter(Boolean).slice(0, 14)
    : String(rawIngredients ?? "")
      .split(/[,|]/g)
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 14);

  if (!title || (!ingredients.length && !instructions)) return null;

  return {
    title,
    ingredients,
    instructions,
    servings,
  };
}

export function hasApiNinjasConfigured() {
  return API_NINJAS_API_KEY.length > 0;
}

export async function fetchApiNinjasRecipes(message: string, limit = 2): Promise<ApiNinjasRecipe[]> {
  if (!hasApiNinjasConfigured()) return [];

  const params = buildSearchParams(message);
  if (![...params.keys()].length) return [];

  const cacheKey = params.toString();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.items.slice(0, limit);
  }

  const recipes = await fetchFromAnyEndpoint(params, Math.max(1, Math.min(limit, 4)));

  cache.set(cacheKey, { at: Date.now(), items: recipes });
  return recipes;
}

export function buildApiNinjasContext(recipes: ApiNinjasRecipe[]) {
  if (!recipes.length) return "";

  const lines = ["API Ninjas recipe matches (use when relevant):"];
  for (const r of recipes) {
    lines.push(`- ${r.title}${r.servings ? ` (${r.servings})` : ""}`);
    if (r.ingredients.length) lines.push(`  ingredients: ${r.ingredients.join(", ")}`);
    if (r.instructions) lines.push(`  instructions: ${r.instructions.slice(0, 700)}`);
  }

  return lines.join("\n");
}

const CATEGORY_KEYWORDS: Record<string, string> = {
  quick: "quick easy",
  healthy: "healthy",
  protein: "high protein",
  vegetarian: "vegetarian",
  seafood: "seafood",
  comfort: "comfort food",
  dessert: "dessert",
  global: "international",
};

export async function searchApiNinjasRecipes(
  query: string,
  category = "",
  limit = 20,
): Promise<ApiNinjasRecipe[]> {
  if (!hasApiNinjasConfigured()) return [];

  const safeQuery = normalizeText(query).slice(0, 100);
  const safeCategory = normalizeText(category);
  const keyword = CATEGORY_KEYWORDS[safeCategory] ?? safeCategory;
  const titleQuery = [safeQuery, keyword].filter(Boolean).join(" ").trim();
  if (!titleQuery) return [];

  const params = new URLSearchParams();
  params.set("title", titleQuery);

  const cappedLimit = Math.max(1, Math.min(limit, 30));
  const cacheKey = `search:${params.toString()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.items.slice(0, cappedLimit);
  }

  const recipes = await fetchFromAnyEndpoint(params, cappedLimit);

  cache.set(cacheKey, { at: Date.now(), items: recipes });
  return recipes;
}

async function fetchFromAnyEndpoint(params: URLSearchParams, limit: number): Promise<ApiNinjasRecipe[]> {
  const errors: string[] = [];

  for (const base of API_NINJAS_URLS) {
    try {
      const res = await fetch(`${base}?${params.toString()}`, {
        headers: { "X-Api-Key": API_NINJAS_API_KEY },
      });
      if (!res.ok) {
        errors.push(`${base} => ${res.status}`);
        continue;
      }
      const data = await res.json().catch(() => []);
      const recipes = Array.isArray(data)
        ? data.map(toRecipe).filter((r): r is ApiNinjasRecipe => Boolean(r)).slice(0, limit)
        : [];
      return recipes;
    } catch (err) {
      errors.push(`${base} => ${String((err as Error)?.message ?? err)}`);
    }
  }

  throw new Error(`API Ninjas request failed (${errors.join(" ; ")})`);
}
