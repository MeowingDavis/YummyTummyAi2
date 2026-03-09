import { HttpError } from "../../server/http.ts";
import type { Msg } from "../chat/history.ts";

export const PANTRY_DEFAULT_RESULTS = 12;
export const PANTRY_MAX_RESULTS = 24;
export const PANTRY_MAX_QUERY_CHARS = 120;
const PANTRY_MAX_OFFSET = 900;
const LAST_RECIPE_SUGGESTIONS_TTL_MS = 2 * 60 * 60 * 1000;

export type RecipeSuggestion = {
  id: number;
  title: string;
  readyInMinutes: number | null;
  servings: number | null;
  sourceUrl: string;
  spoonacularSourceUrl: string;
};

export type RecipeDetail = RecipeSuggestion & {
  image: string;
  summary: string;
  instructions: string;
  ingredients: string[];
};

export type PantrySearchResult = RecipeSuggestion & {
  image: string;
};

const lastRecipeSuggestionsByOwner = new Map<
  string,
  {
    at: number;
    query: string;
    suggestions: RecipeSuggestion[];
  }
>();

export function parsePantryResultCount(value: string | null) {
  const n = Number(value ?? PANTRY_DEFAULT_RESULTS);
  if (!Number.isFinite(n)) return PANTRY_DEFAULT_RESULTS;
  const asInt = Math.trunc(n);
  if (asInt < 1) return 1;
  if (asInt > PANTRY_MAX_RESULTS) return PANTRY_MAX_RESULTS;
  return asInt;
}

export function parsePantryOffset(value: string | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  const asInt = Math.trunc(n);
  if (asInt < 0) return 0;
  if (asInt > PANTRY_MAX_OFFSET) return PANTRY_MAX_OFFSET;
  return asInt;
}

export function parsePantryMaxReadyTime(value: string | null) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const asInt = Math.trunc(n);
  if (asInt < 1) return null;
  if (asInt > 240) return 240;
  return asInt;
}

export function parsePantryRecipeId(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const asInt = Math.trunc(n);
  if (asInt <= 0) return null;
  return asInt;
}

function normalizeDiet(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDietTag(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function recipeMatchesDiet(
  item: Record<string, unknown>,
  selectedDiet: string,
) {
  const diet = normalizeDiet(selectedDiet);
  if (!diet) return true;

  const diets = Array.isArray(item.diets)
    ? item.diets.map((v) => normalizeDietTag(v))
    : [];
  const hasDietTag = (tag: string) => diets.includes(tag);
  const vegetarian = Boolean(item.vegetarian);
  const vegan = Boolean(item.vegan);
  const glutenFree = Boolean(item.glutenFree);

  switch (diet) {
    case "vegetarian":
      return vegetarian || hasDietTag("vegetarian");
    case "vegan":
      return vegan || hasDietTag("vegan");
    case "gluten free":
      return glutenFree || hasDietTag("gluten free");
    case "ketogenic":
    case "keto":
      return hasDietTag("ketogenic") || hasDietTag("keto");
    case "paleo":
      return hasDietTag("paleo") || hasDietTag("paleolithic");
    default:
      return true;
  }
}

function stripHtml(value: unknown) {
  const text = String(value ?? "");
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpoonacularPayload(text: string) {
  return text ? JSON.parse(text) : {};
}

function assertApiKey(apiKey: string) {
  if (apiKey.trim()) return;
  throw new HttpError(503, "Recipe search is not configured on this server.");
}

export async function searchPantryRecipes(
  apiKey: string,
  params: {
    query: string;
    number: number;
    offset: number;
    diet?: string;
    cuisine?: string;
    maxReadyTime?: number | null;
  },
) {
  assertApiKey(apiKey);
  const apiUrl = new URL("https://api.spoonacular.com/recipes/complexSearch");
  apiUrl.searchParams.set("apiKey", apiKey);
  apiUrl.searchParams.set("query", params.query);
  const upstreamNumber = params.diet
    ? Math.min(PANTRY_MAX_RESULTS * 4, 96)
    : params.number;
  apiUrl.searchParams.set("number", String(upstreamNumber));
  apiUrl.searchParams.set("offset", String(params.offset));
  if (params.diet) apiUrl.searchParams.set("diet", params.diet);
  if (params.cuisine) apiUrl.searchParams.set("cuisine", params.cuisine);
  if (params.maxReadyTime) {
    apiUrl.searchParams.set("maxReadyTime", String(params.maxReadyTime));
  }
  apiUrl.searchParams.set("sort", "popularity");
  apiUrl.searchParams.set("sortDirection", "desc");
  apiUrl.searchParams.set("addRecipeInformation", "true");

  const upstream = await fetch(apiUrl, {
    headers: { "Accept": "application/json" },
  });
  const data = parseSpoonacularPayload(await upstream.text());
  if (!upstream.ok) {
    const message = typeof data?.message === "string"
      ? data.message
      : `Recipe search failed (${upstream.status})`;
    const status = upstream.status === 401 || upstream.status === 402 ||
        upstream.status === 429
      ? upstream.status
      : 502;
    throw new HttpError(status, message);
  }

  const rawResults = Array.isArray(data?.results) ? data.results : [];
  const filteredResults = params.diet
    ? rawResults.filter((item: Record<string, unknown>) =>
      recipeMatchesDiet(item, params.diet ?? "")
    )
    : rawResults;
  const results = filteredResults
    .slice(0, params.number)
    .map((item: Record<string, unknown>) => ({
      id: Number(item.id ?? 0) || 0,
      title: String(item.title ?? ""),
      image: String(item.image ?? ""),
      readyInMinutes: Number(item.readyInMinutes ?? 0) || null,
      servings: Number(item.servings ?? 0) || null,
      sourceUrl: String(item.sourceUrl ?? ""),
      spoonacularSourceUrl: String(item.spoonacularSourceUrl ?? ""),
    }));

  return {
    totalResults: Number(data?.totalResults ?? results.length),
    results,
  };
}

export async function fetchRecipeDetailById(apiKey: string, id: number) {
  assertApiKey(apiKey);
  const apiUrl = new URL(`https://api.spoonacular.com/recipes/${id}/information`);
  apiUrl.searchParams.set("apiKey", apiKey);
  apiUrl.searchParams.set("includeNutrition", "false");

  const upstream = await fetch(apiUrl, {
    headers: { "Accept": "application/json" },
  });
  const data = parseSpoonacularPayload(await upstream.text());
  if (!upstream.ok) {
    const message = typeof data?.message === "string"
      ? data.message
      : `Recipe details failed (${upstream.status})`;
    const status = upstream.status === 401 || upstream.status === 402 ||
        upstream.status === 404 || upstream.status === 429
      ? upstream.status
      : 502;
    throw new HttpError(status, message);
  }

  const ingredients = Array.isArray(data?.extendedIngredients)
    ? data.extendedIngredients.map((item: Record<string, unknown>) =>
      stripHtml(item.original || item.name)
    ).filter(Boolean)
    : [];

  return {
    id: Number(data?.id ?? id) || id,
    title: stripHtml(data?.title),
    image: String(data?.image ?? ""),
    readyInMinutes: Number(data?.readyInMinutes ?? 0) || null,
    servings: Number(data?.servings ?? 0) || null,
    summary: stripHtml(data?.summary),
    instructions: stripHtml(data?.instructions),
    ingredients,
    sourceUrl: String(data?.sourceUrl ?? ""),
    spoonacularSourceUrl: String(data?.spoonacularSourceUrl ?? ""),
  } satisfies RecipeDetail;
}

export function recipeDetailToMarkdown(detail: RecipeDetail) {
  const lines: string[] = [];
  lines.push(`## ${detail.title || "Recipe"}`);
  const meta: string[] = [];
  if (detail.readyInMinutes) meta.push(`${detail.readyInMinutes} min`);
  if (detail.servings) meta.push(`${detail.servings} servings`);
  if (meta.length) lines.push(meta.join(" • "));
  if (detail.summary) {
    lines.push("");
    lines.push(detail.summary);
  }
  lines.push("");
  lines.push("### Ingredients");
  if (detail.ingredients.length) {
    detail.ingredients.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push("- Ingredient list not available");
  }
  lines.push("");
  lines.push("### Instructions");
  lines.push(detail.instructions || "Instructions not available.");
  if (detail.id) {
    const pantryLink =
      `/recipes.html?recipeId=${encodeURIComponent(String(detail.id))}`;
    lines.push("");
    lines.push(`Open in Pantry: ${pantryLink}`);
  }
  const link = detail.sourceUrl || detail.spoonacularSourceUrl;
  if (link && !detail.id) {
    lines.push("");
    lines.push(`Source: ${link}`);
  }
  return lines.join("\n");
}

export function parseRecipeCommand(message: string) {
  const match = message.match(/^\/recipe(?:\s+(.+))?$/i);
  if (!match) return null;
  return { query: String(match[1] ?? "").trim() };
}

export async function fetchRecipeSuggestions(
  apiKey: string,
  query: string,
  number = 5,
  contextText = "",
) {
  assertApiKey(apiKey);
  const apiUrl = new URL("https://api.spoonacular.com/recipes/complexSearch");
  const context = contextText.toLowerCase();
  const diet = /\bgluten[ -]?free\b/.test(context)
    ? "gluten free"
    : /\bvegetarian\b/.test(context)
    ? "vegetarian"
    : /\bvegan\b/.test(context)
    ? "vegan"
    : /\b(keto|ketogenic)\b/.test(context)
    ? "ketogenic"
    : /\bpaleo\b/.test(context)
    ? "paleo"
    : "";
  const cuisine = [
    "italian",
    "mexican",
    "american",
    "indian",
    "thai",
    "japanese",
    "mediterranean",
  ].find((c) => new RegExp(`\\b${c}\\b`).test(context)) || "";
  const readyMatch = context.match(/\b(\d{1,3})\s*(min|mins|minute|minutes)\b/);
  const maxReadyTime = readyMatch ? Math.min(Number(readyMatch[1]), 240) : 0;
  apiUrl.searchParams.set("apiKey", apiKey);
  apiUrl.searchParams.set("query", query);
  apiUrl.searchParams.set("number", String(Math.max(1, Math.min(number, 8))));
  apiUrl.searchParams.set("addRecipeInformation", "true");
  if (diet) apiUrl.searchParams.set("diet", diet);
  if (cuisine) apiUrl.searchParams.set("cuisine", cuisine);
  if (maxReadyTime > 0) {
    apiUrl.searchParams.set("maxReadyTime", String(maxReadyTime));
  }
  apiUrl.searchParams.set("sort", "popularity");
  apiUrl.searchParams.set("sortDirection", "desc");

  const upstream = await fetch(apiUrl, {
    headers: { "Accept": "application/json" },
  });
  const data = parseSpoonacularPayload(await upstream.text());
  if (!upstream.ok) {
    const message = typeof data?.message === "string"
      ? data.message
      : `Recipe search failed (${upstream.status})`;
    const status = upstream.status === 401 || upstream.status === 402 ||
        upstream.status === 429
      ? upstream.status
      : 502;
    throw new HttpError(status, message);
  }

  const rawResults = Array.isArray(data?.results) ? data.results : [];
  return rawResults.map((item: Record<string, unknown>) => ({
    id: Number(item.id ?? 0) || 0,
    title: String(item.title ?? "Untitled recipe"),
    readyInMinutes: Number(item.readyInMinutes ?? 0) || null,
    servings: Number(item.servings ?? 0) || null,
    sourceUrl: String(item.sourceUrl ?? ""),
    spoonacularSourceUrl: String(item.spoonacularSourceUrl ?? ""),
  })) satisfies RecipeSuggestion[];
}

export function setLastRecipeSuggestions(
  ownerKey: string,
  query: string,
  suggestions: RecipeSuggestion[],
) {
  lastRecipeSuggestionsByOwner.set(ownerKey, {
    at: Date.now(),
    query,
    suggestions,
  });
}

export function getLastRecipeSuggestions(ownerKey: string) {
  const value = lastRecipeSuggestionsByOwner.get(ownerKey);
  if (!value) return null;
  if (Date.now() - value.at > LAST_RECIPE_SUGGESTIONS_TTL_MS) {
    lastRecipeSuggestionsByOwner.delete(ownerKey);
    return null;
  }
  return {
    query: value.query,
    suggestions: value.suggestions,
  };
}

export function clearLastRecipeSuggestions(ownerKey: string) {
  lastRecipeSuggestionsByOwner.delete(ownerKey);
}

function parseSuggestedRecipeIndex(message: string) {
  const t = message.toLowerCase();
  const ordinalMap: Array<[RegExp, number]> = [
    [/\b(first|1st)\b/, 0],
    [/\b(second|2nd)\b/, 1],
    [/\b(third|3rd)\b/, 2],
    [/\b(fourth|4th)\b/, 3],
    [/\b(fifth|5th)\b/, 4],
    [/\b(sixth|6th)\b/, 5],
    [/\b(seventh|7th)\b/, 6],
    [/\b(eighth|8th)\b/, 7],
  ];
  for (const [rx, idx] of ordinalMap) {
    if (rx.test(t)) return idx;
  }
  const numMatch = t.match(/\b(?:#|number\s*)?(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (Number.isFinite(n) && n > 0) return n - 1;
  }
  return null;
}

function tokenizeForMatch(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) =>
      ![
        "the",
        "a",
        "an",
        "that",
        "this",
        "sounds",
        "good",
        "great",
        "nice",
        "please",
        "can",
        "could",
        "would",
        "like",
        "want",
        "get",
        "give",
        "me",
        "recipe",
        "recipes",
        "for",
        "to",
        "of",
        "with",
        "one",
      ].includes(t)
    );
}

export function isRecipeSelectionFollowup(message: string) {
  const t = message.toLowerCase();
  return /\b(sounds good|sounds great|i'?ll take|i want|i'd like|give me that|that one|this one|the first|the second|the third|recipe for|make that)\b/
    .test(t);
}

export function resolveSuggestedRecipeFromMessage(
  message: string,
  suggestions: RecipeSuggestion[],
) {
  if (!suggestions.length) return null;
  const idx = parseSuggestedRecipeIndex(message);
  if (idx !== null && idx >= 0 && idx < suggestions.length) {
    return suggestions[idx];
  }
  const t = message.toLowerCase();
  const byTitle = suggestions.find((suggestion) =>
    t.includes(suggestion.title.toLowerCase())
  );
  if (byTitle) return byTitle;

  const queryTokens = tokenizeForMatch(message);
  if (!queryTokens.length) return null;
  let best:
    | {
      score: number;
      suggestion: RecipeSuggestion;
    }
    | null = null;
  for (const suggestion of suggestions) {
    const titleTokens = new Set(tokenizeForMatch(suggestion.title));
    if (!titleTokens.size) continue;
    let score = 0;
    for (const token of queryTokens) {
      if (titleTokens.has(token)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, suggestion };
    }
  }
  return best?.suggestion ?? null;
}

export function recipeSuggestionsToMarkdown(
  query: string,
  suggestions: RecipeSuggestion[],
) {
  if (!suggestions.length) {
    return `I couldn't find recipe matches for "${query}". Try another ingredient or dish name.`;
  }
  const lines = [`## Recipe ideas for "${query}"`, ""];
  suggestions.forEach((item, index) => {
    const metaParts: string[] = [];
    if (item.readyInMinutes) metaParts.push(`${item.readyInMinutes} min`);
    if (item.servings) metaParts.push(`${item.servings} servings`);
    const meta = metaParts.length ? ` (${metaParts.join(" • ")})` : "";
    const pantryLink = item.id
      ? `/recipes.html?recipeId=${encodeURIComponent(String(item.id))}`
      : "";
    if (pantryLink) {
      lines.push(
        `${index + 1}. **${item.title}**${meta} - [Show recipe](${pantryLink})`,
      );
    } else {
      lines.push(`${index + 1}. **${item.title}**${meta}`);
    }
  });
  lines.push("");
  lines.push("Tip: use `/recipe <ingredients or dish>` to search again.");
  return lines.join("\n");
}

export function recentRecipeContext(history: Msg[], currentMessage: string) {
  const recentUser = history
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((text) => text && !text.startsWith("/"))
    .slice(-5);
  return [...recentUser, currentMessage.trim()].filter(Boolean).join("\n");
}

export function inferRecipeQueryFromContext(
  explicitQuery: string,
  history: Msg[],
  currentMessage: string,
) {
  if (explicitQuery.trim()) return explicitQuery.trim();
  const fallback = history
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((text) => text && !text.startsWith("/"))
    .slice(-1)[0];
  return fallback || currentMessage.trim() || "quick dinner ideas";
}

export function buildRecipeRagSteer(
  query: string,
  suggestions: RecipeSuggestion[],
) {
  if (!suggestions.length) return "";
  const lines = [
    "Retrieved recipe grounding (Spoonacular):",
    `query: ${query}`,
    "Use these retrieved options as your source of truth for recipe names and suggestions.",
    "Do not invent extra recipe names outside this list unless you clearly say no exact match was retrieved.",
    "",
    "RETRIEVED:",
  ];
  suggestions.forEach((item, idx) => {
    const meta: string[] = [];
    if (item.readyInMinutes) meta.push(`${item.readyInMinutes} min`);
    if (item.servings) meta.push(`${item.servings} servings`);
    const link = item.sourceUrl || item.spoonacularSourceUrl || "";
    lines.push(
      `${idx + 1}. ${item.title}${
        meta.length ? ` (${meta.join(", ")})` : ""
      }${link ? ` | ${link}` : ""}`,
    );
  });
  return lines.join("\n");
}
