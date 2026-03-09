// src/features/chat/modes.ts
import type { Msg } from "./history.ts";
import {
  FOOD_ALLOWLIST,
  hasFoodSignal,
  isSmallTalk,
  TECH_BLOCKLIST,
} from "./guard.ts";

export type Mode = "INGREDIENTS" | "IDEAS" | "EXPAND" | "MORE_IDEAS" | "CHAT";

export function detectMode(user: string, lastAssistant: string): Mode {
  const t = user.toLowerCase().trim();

  if (isSmallTalk(t)) return "CHAT";
  if (!hasFoodSignal(t, lastAssistant)) return "CHAT";

  // direct expansion cues
  if (
    /\b(full recipe|steps|ingredients|details|expand|make that|how do i make|how to make)\b/i
      .test(t)
  ) return "EXPAND";
  if (/\b(more|more ideas|another|others|give me more)\b/i.test(t)) {
    return "MORE_IDEAS";
  }

  // "that one", "the second", or referencing a dish name from last assistant
  if (
    /\b(that one|this one|the first|the second|the third|number\s*\d+)\b/i.test(
      t,
    )
  ) return "EXPAND";
  // if user echoes a word from last list like "middle eastern", "chickpea", "pilaf", etc.
  if (
    lastAssistant &&
    /\b(bowl|stew|curry|pilaf|harvest|chickpea|mediterranean|middle eastern|risotto|fiesta|green goddess|summer breeze)\b/i
      .test(t)
  ) {
    return "EXPAND";
  }

  const mentionsTech = TECH_BLOCKLIST.some((w) => t.includes(w));
  const foodHits = FOOD_ALLOWLIST.filter((w) => t.includes(w)).length;

  const mentionsQuant =
    /\b(\d+|\d+\s*\/\s*\d+)\s*(g|kg|ml|l|cup|cups|tsp|tbsp)\b/.test(t);
  const ingredientCue =
    /\b(i have|with|on hand|pantry|fridge|ingredients|leftovers|using)\b/.test(
      t,
    );
  const listy = /[,;\n]/.test(t) || (/\band\b/.test(t) && foodHits >= 2);

  if (
    !mentionsTech &&
    (mentionsQuant ||
      ((ingredientCue || listy) && (foodHits >= 1 || ingredientCue)))
  ) {
    return "INGREDIENTS";
  }

  // idea triggers
  const ideaTriggers = [
    "what should i cook",
    "dinner ideas",
    "lunch ideas",
    "breakfast ideas",
    "recipe ideas",
    "give me ideas",
    "i need ideas",
    "what's for dinner",
    "what can i cook",
    "suggest a meal",
    "meal ideas",
    "juice ideas",
    "refreshing juice ideas",
  ];
  if (ideaTriggers.some((k) => t.includes(k))) return "IDEAS";

  // default to ideas for vague cooking queries
  return "IDEAS";
}

const IDEA_STEER = `
You are in Idea Mode.
- Provide 4 or 5 ideas matching any constraints (time, diet, budget, cuisine).
- Format as a short numbered list, each item = **Dish Name** — 1 short sentence.
- Do not include full ingredient lists or multi-step methods.
- End with one natural follow-up question inviting the user to pick one to expand.
`.trim();

const MORE_IDEAS_STEER = `
Continue Idea Mode.
- Provide 4 or 5 different ideas from your last list.
- Same format: numbered list, **Dish Name** — 1 short sentence.
- No full recipes yet.
- End with one natural follow-up question inviting selection.
`.trim();

const INGREDIENTS_STEER = `
You are in Ingredient Mode.
- User gave specific ingredients. Suggest 1-3 recipes that make strong use of those items.
- You may suggest one or two clearly-labeled extra staples if they materially improve the dish.
- Keep steps short and practical.
`.trim();

const EXPAND_STEER = `
Selection/Expansion Mode.
- The user likely selected one idea from your last list (by name or position). Choose the best match from your previous ideas and output a complete, clear recipe.
- Include: ingredients with amounts, concise steps (numbered), timing, and key tips or substitutions.
- Respect any dietary constraints mentioned earlier.
`.trim();

const CHAT_STEER = `
Conversational Mode.
- Reply naturally, like a relaxed food-savvy assistant rather than a rigid recipe bot.
- No forced numbered list unless the user asked for one.
- If the user is not directly asking for food help, answer briefly and nudge the conversation toward cravings, ingredients, diets, meal plans, or cooking.
`.trim();

export function steerForMode(mode: Mode): Msg {
  return {
    role: "system",
    content: mode === "IDEAS"
      ? IDEA_STEER
      : mode === "MORE_IDEAS"
      ? MORE_IDEAS_STEER
      : mode === "INGREDIENTS"
      ? INGREDIENTS_STEER
      : mode === "CHAT"
      ? CHAT_STEER
      : EXPAND_STEER,
  };
}
