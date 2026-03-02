import type { RecipeHit, RecipeRecord } from "./types.ts";

type CorpusCache = {
  path: string;
  mtimeMs: number;
  recipes: RecipeRecord[];
};

let cache: CorpusCache | null = null;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "i", "if", "in", "into",
  "is", "it", "its", "me", "my", "of", "on", "or", "so", "that", "the", "to", "we", "what", "with",
  "you", "your", "want", "like", "make", "cook", "recipe", "recipes",
]);

function corpusPath() {
  return Deno.env.get("RECIPES_DB_PATH")?.trim() || "data/recipes.json";
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function normalizeRecipe(raw: any, i: number): RecipeRecord | null {
  const title = String(raw?.title ?? "").trim();
  if (!title) return null;
  const ingredients = asArray(raw?.ingredients);
  const instructions = asArray(raw?.instructions);
  if (!ingredients.length && !instructions.length) return null;

  const id = String(raw?.id ?? "").trim() || `${slug(title)}-${i + 1}`;
  return {
    id,
    title,
    ingredients,
    instructions,
    tags: asArray(raw?.tags),
    cuisine: raw?.cuisine ? String(raw.cuisine).trim() : undefined,
    source: raw?.source ? String(raw.source).trim() : undefined,
  };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

async function statMtime(path: string) {
  try {
    const st = await Deno.stat(path);
    return st.mtime?.getTime() ?? 0;
  } catch {
    return 0;
  }
}

async function loadRecipes(): Promise<RecipeRecord[]> {
  const path = corpusPath();
  const mtimeMs = await statMtime(path);

  if (cache && cache.path === path && cache.mtimeMs === mtimeMs) {
    return cache.recipes;
  }

  let text = "[]";
  try {
    text = await Deno.readTextFile(path);
  } catch {
    cache = { path, mtimeMs, recipes: [] };
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    cache = { path, mtimeMs, recipes: [] };
    return [];
  }

  const arr = Array.isArray(parsed) ? parsed : [];
  const recipes = arr.map((r, i) => normalizeRecipe(r, i)).filter((r): r is RecipeRecord => !!r);

  cache = { path, mtimeMs, recipes };
  return recipes;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreRecipe(queryTokens: string[], recipe: RecipeRecord): { score: number; why: string[] } {
  const titleTokens = new Set(tokenize(recipe.title));
  const ingredientTokens = new Set(tokenize(recipe.ingredients.join(" ")));
  const instructionTokens = new Set(tokenize(recipe.instructions.join(" ")));
  const tagTokens = new Set(tokenize((recipe.tags ?? []).join(" ")));

  let score = 0;
  const why: string[] = [];

  for (const t of queryTokens) {
    if (titleTokens.has(t)) {
      score += 3;
      if (why.length < 5) why.push(`title:${t}`);
      continue;
    }
    if (ingredientTokens.has(t)) {
      score += 2;
      if (why.length < 5) why.push(`ingredient:${t}`);
      continue;
    }
    if (tagTokens.has(t)) {
      score += 1.5;
      if (why.length < 5) why.push(`tag:${t}`);
      continue;
    }
    if (instructionTokens.has(t)) {
      score += 1;
      if (why.length < 5) why.push(`steps:${t}`);
    }
  }

  return { score, why };
}

export async function retrieveRecipes(query: string, limit = 3): Promise<RecipeHit[]> {
  const recipes = await loadRecipes();
  if (!recipes.length) return [];

  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const hits = recipes
    .map((recipe) => {
      const { score, why } = scoreRecipe(queryTokens, recipe);
      return { recipe, score, why };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return hits;
}

export function hasStrongRecipeMatch(hits: RecipeHit[], threshold = 4): boolean {
  if (!hits.length) return false;
  return hits[0].score >= threshold;
}

export function buildRecipeContext(hits: RecipeHit[]): string {
  if (!hits.length) return "";
  const lines: string[] = [
    "Recipe library matches (use when relevant):",
  ];

  for (const hit of hits) {
    const r = hit.recipe;
    const ingredients = r.ingredients.slice(0, 12).join(", ");
    const steps = r.instructions.slice(0, 4).join(" | ");
    const meta = [r.cuisine, ...(r.tags ?? []).slice(0, 4)].filter(Boolean).join(", ");
    lines.push(`- [${r.id}] ${r.title}${meta ? ` (${meta})` : ""}`);
    if (ingredients) lines.push(`  ingredients: ${ingredients}`);
    if (steps) lines.push(`  steps: ${steps}`);
    if (r.source) lines.push(`  source: ${r.source}`);
  }

  return lines.join("\n");
}
