import type { UserProfile } from "../auth.ts";

const DIRECT_DIET_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  {
    pattern: /\b(?:i am|i'm|im|i eat|i follow|i'm doing|im doing)\s+(vegan)\b/i,
    value: "vegan",
  },
  {
    pattern:
      /\b(?:i am|i'm|im|i eat|i follow|i'm doing|im doing)\s+(vegetarian)\b/i,
    value: "vegetarian",
  },
  {
    pattern:
      /\b(?:i am|i'm|im|i eat|i follow|i'm doing|im doing)\s+(pescatarian)\b/i,
    value: "pescatarian",
  },
  {
    pattern: /\b(?:i am|i'm|im|i'm doing|im doing)\s+(keto|ketogenic)\b/i,
    value: "keto",
  },
  {
    pattern: /\b(?:i am|i'm|im|i eat)\s+(halal)\b/i,
    value: "halal",
  },
  {
    pattern: /\b(?:i am|i'm|im|i eat)\s+(kosher)\b/i,
    value: "kosher",
  },
  {
    pattern: /\b(?:i am|i'm|im)\s+(gluten[- ]free)\b/i,
    value: "gluten-free",
  },
  {
    pattern: /\b(?:i am|i'm|im)\s+(dairy[- ]free)\b/i,
    value: "dairy-free",
  },
  {
    pattern: /\b(?:i am|i'm|im)\s+(low[- ]carb)\b/i,
    value: "low-carb",
  },
  {
    pattern: /\b(?:i am|i'm|im)\s+(lactose intolerant)\b/i,
    value: "lactose intolerant",
  },
];

const STABLE_AVOIDANCE_MAP = new Map<string, string>([
  ["pork", "no pork"],
  ["beef", "no beef"],
  ["chicken", "no chicken"],
  ["meat", "no meat"],
  ["seafood", "no seafood"],
  ["shellfish", "shellfish-free"],
  ["dairy", "dairy-free"],
  ["gluten", "gluten-free"],
  ["egg", "egg-free"],
  ["eggs", "egg-free"],
]);

function normalizeItem(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function dedupe(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeItem(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitList(raw: string) {
  return raw
    .split(/\s*(?:,|\/|&|\band\b)\s*/i)
    .map(normalizeItem)
    .filter(Boolean)
    .slice(0, 12);
}

function toTitleCase(value: string) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function extractAfter(message: string, pattern: RegExp) {
  const match = message.match(pattern);
  return match?.[1] ? splitList(match[1]) : [];
}

function extractDietaryRequirements(message: string) {
  const found = DIRECT_DIET_PATTERNS
    .filter(({ pattern }) => pattern.test(message))
    .map(({ value }) => value);

  const avoidances = extractAfter(
    message,
    /\b(?:i do not eat|i don't eat|i cant eat|i can't eat|i avoid|i never eat)\s+([a-z0-9 ,/&-]+?)(?:[.!?]|$)/i,
  )
    .map((item) => STABLE_AVOIDANCE_MAP.get(item) ?? "")
    .filter(Boolean);

  return dedupe([...found, ...avoidances]);
}

function extractAllergies(message: string) {
  const explicit = extractAfter(
    message,
    /\b(?:i am|i'm|im)?\s*allergic to\s+([a-z0-9 ,/&-]+?)(?:[.!?]|$)/i,
  );
  const named = extractAfter(
    message,
    /\b(?:i have|i've got|ive got|my)\s+([a-z0-9 ,/&-]+?)\s+allerg(?:y|ies)\b/i,
  );
  return dedupe([...explicit, ...named]).map(toTitleCase);
}

function extractDislikes(message: string) {
  const dislikes = extractAfter(
    message,
    /\b(?:i hate|i don't like|i do not like|i can't stand|i cant stand|i'm not a fan of|im not a fan of)\s+([a-z0-9 ,/&-]+?)(?:[.!?]|$)/i,
  );
  return dedupe(dislikes).map(toTitleCase);
}

function hasStablePreferenceCue(message: string) {
  return /\b(i am|i'm|im|i eat|i follow|i do not eat|i don't eat|i avoid|allergic to|allergy|i hate|i don't like|i do not like|i can't stand|i cant stand|i'm not a fan of|im not a fan of)\b/i
    .test(message);
}

export function extractProfileMemory(message: string): UserProfile | null {
  if (!hasStablePreferenceCue(message)) return null;

  const dietaryRequirements = extractDietaryRequirements(message);
  const allergies = extractAllergies(message);
  const dislikes = extractDislikes(message);

  if (
    !dietaryRequirements.length &&
    !allergies.length &&
    !dislikes.length
  ) {
    return null;
  }

  return {
    dietaryRequirements,
    allergies,
    dislikes,
  };
}

function mergeField(base: string[] = [], patch: string[] = []) {
  return dedupe([...base, ...patch]);
}

export function mergeUserProfile(
  current?: UserProfile,
  patch?: UserProfile | null,
): UserProfile | undefined {
  if (!current && !patch) return undefined;
  const dietaryRequirements = mergeField(
    current?.dietaryRequirements,
    patch?.dietaryRequirements,
  );
  const allergies = mergeField(current?.allergies, patch?.allergies);
  const dislikes = mergeField(current?.dislikes, patch?.dislikes);

  if (!dietaryRequirements.length && !allergies.length && !dislikes.length) {
    return undefined;
  }

  return {
    dietaryRequirements,
    allergies,
    dislikes,
  };
}
