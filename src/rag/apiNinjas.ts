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
  "https://api.api-ninjas.com/v3/recipe",
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
    ? rawIngredients
      .map((v) => normalizeIngredient(v))
      .filter(Boolean)
      .slice(0, 14)
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

function normalizeIngredient(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const obj = value as Record<string, unknown>;
  const name = String(obj.ingredient ?? obj.name ?? "").trim();
  const quantity = String(obj.quantity ?? obj.amount ?? "").trim();
  const unit = String(obj.unit ?? "").trim();

  return [quantity, unit, name].filter(Boolean).join(" ").trim();
}

export function hasApiNinjasConfigured() {
  return API_NINJAS_API_KEY.length > 0;
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
const BROWSE_TERMS = [
  "chicken",
  "pasta",
  "salad",
  "seafood",
  "vegetarian",
  "beef",
  "dessert",
  "soup",
];

export async function searchApiNinjasRecipes(
  query: string,
  category = "",
  limit = 10,
  offset = 0,
): Promise<ApiNinjasRecipe[]> {
  if (!hasApiNinjasConfigured()) return [];

  const safeQuery = normalizeText(query).slice(0, 100);
  const safeCategory = normalizeText(category);
  const keyword = CATEGORY_KEYWORDS[safeCategory] ?? safeCategory;
  if (!safeQuery && !keyword) return [];

  const cappedLimit = Math.max(1, Math.min(limit, 10));
  const safeOffset = Math.max(0, Math.floor(offset));
  const titleAttempts = buildTitleAttempts(safeQuery, keyword);

  for (const titleQuery of titleAttempts) {
    const params = new URLSearchParams();
    params.set("title", titleQuery);
    params.set("limit", String(cappedLimit));
    if (safeOffset > 0) params.set("offset", String(safeOffset));

    const cacheKey = `search:${params.toString()}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      if (hit.items.length) return hit.items.slice(0, cappedLimit);
      continue;
    }

    const recipes = await fetchFromAnyEndpoint(params, cappedLimit);
    cache.set(cacheKey, { at: Date.now(), items: recipes });
    if (recipes.length) return recipes;
  }

  return [];
}

export async function browseApiNinjasRecipes(limit = 10, offset = 0): Promise<ApiNinjasRecipe[]> {
  if (!hasApiNinjasConfigured()) return [];

  const cappedLimit = Math.max(1, Math.min(limit, 10));
  const safeOffset = Math.max(0, Math.floor(offset));
  const startIndex = safeOffset % BROWSE_TERMS.length;
  const attempts = [
    ...BROWSE_TERMS.slice(startIndex),
    ...BROWSE_TERMS.slice(0, startIndex),
  ];

  for (const term of attempts) {
    const params = new URLSearchParams();
    params.set("title", term);
    params.set("limit", String(cappedLimit));
    if (safeOffset > 0) params.set("offset", String(safeOffset));

    const cacheKey = `browse:${params.toString()}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      if (hit.items.length) return hit.items.slice(0, cappedLimit);
      continue;
    }

    const recipes = await fetchFromAnyEndpoint(params, cappedLimit);
    cache.set(cacheKey, { at: Date.now(), items: recipes });
    if (recipes.length) return recipes;
  }

  return [];
}

function buildTitleAttempts(query: string, categoryKeyword: string) {
  const attempts: string[] = [];
  const q = query.trim();
  const c = categoryKeyword.trim();

  // Prefer category-aware search first, but gracefully fall back to the plain query.
  if (q && c) attempts.push(`${q} ${c}`.trim(), q, c);
  else if (q) attempts.push(q);
  else if (c) attempts.push(c);

  return Array.from(new Set(attempts)).slice(0, 3);
}

async function fetchFromAnyEndpoint(params: URLSearchParams, limit: number): Promise<ApiNinjasRecipe[]> {
  const errors: string[] = [];

  for (const base of API_NINJAS_URLS) {
    try {
      const res = await fetch(`${base}?${params.toString()}`, {
        headers: { "X-Api-Key": API_NINJAS_API_KEY },
      });
      if (!res.ok) {
        // Fallback for non-premium keys: retry without premium-only params.
        if (res.status >= 400 && res.status < 500 && (params.has("ingredients") || params.has("limit") || params.has("offset"))) {
          const downgraded = new URLSearchParams(params);
          downgraded.delete("ingredients");
          downgraded.delete("limit");
          downgraded.delete("offset");
          const retry = await fetch(`${base}?${downgraded.toString()}`, {
            headers: { "X-Api-Key": API_NINJAS_API_KEY },
          });
          if (!retry.ok) {
            errors.push(`${base} => ${res.status}/${retry.status}`);
            continue;
          }
          const retryData = await retry.json().catch(() => []);
          const retryRecipes = Array.isArray(retryData)
            ? retryData.map(toRecipe).filter((r): r is ApiNinjasRecipe => Boolean(r)).slice(0, limit)
            : [];
          return retryRecipes;
        }
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
