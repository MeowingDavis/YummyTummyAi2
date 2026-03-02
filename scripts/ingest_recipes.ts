import type { RecipeRecord } from "../src/rag/types.ts";

function usage() {
  console.log("Usage: deno task ingest-recipes <path-to-json-or-jsonl>");
  console.log("Optional env: RECIPES_DB_PATH (default: data/recipes.json)");
}

function dbPath() {
  return Deno.env.get("RECIPES_DB_PATH")?.trim() || "data/recipes.json";
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/\n|,/) 
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function normalize(input: any, i: number): RecipeRecord | null {
  const title = String(input?.title ?? "").trim();
  if (!title) return null;

  const ingredients = toArray(input?.ingredients);
  const instructions = toArray(input?.instructions);
  if (!ingredients.length && !instructions.length) return null;

  const id = String(input?.id ?? "").trim() || `${slug(title)}-${i + 1}`;

  return {
    id,
    title,
    ingredients,
    instructions,
    tags: toArray(input?.tags),
    cuisine: input?.cuisine ? String(input.cuisine).trim() : undefined,
    source: input?.source ? String(input.source).trim() : undefined,
  };
}

async function readRecipes(path: string): Promise<RecipeRecord[]> {
  const raw = await Deno.readTextFile(path);
  if (path.toLowerCase().endsWith(".jsonl")) {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        try {
          return normalize(JSON.parse(line), i);
        } catch {
          return null;
        }
      })
      .filter((x): x is RecipeRecord => !!x);
  }

  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.recipes) ? parsed.recipes : [];
  return rows.map((row, i) => normalize(row, i)).filter((x): x is RecipeRecord => !!x);
}

function keyOf(r: RecipeRecord) {
  return (r.id || r.title).toLowerCase();
}

async function readExisting(path: string): Promise<RecipeRecord[]> {
  try {
    const raw = await Deno.readTextFile(path);
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [];
    return rows.map((r, i) => normalize(r, i)).filter((x): x is RecipeRecord => !!x);
  } catch {
    return [];
  }
}

if (import.meta.main) {
  const sourcePath = Deno.args[0];
  if (!sourcePath) {
    usage();
    Deno.exit(1);
  }

  const incoming = await readRecipes(sourcePath);
  if (!incoming.length) {
    console.error("No valid recipes found in input file.");
    Deno.exit(1);
  }

  const outPath = dbPath();
  const existing = await readExisting(outPath);
  const map = new Map<string, RecipeRecord>();

  for (const r of existing) map.set(keyOf(r), r);

  let added = 0;
  let updated = 0;
  for (const r of incoming) {
    const key = keyOf(r);
    if (map.has(key)) updated += 1;
    else added += 1;
    map.set(key, r);
  }

  const merged = [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  await Deno.mkdir(outPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  await Deno.writeTextFile(outPath, JSON.stringify(merged, null, 2) + "\n");

  console.log(`Wrote ${outPath}`);
  console.log(`Added: ${added}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total recipes: ${merged.length}`);
}
