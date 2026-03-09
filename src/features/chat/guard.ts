export const FOOD_ALLOWLIST = [
  "cook",
  "cooking",
  "recipe",
  "recipes",
  "ingredient",
  "ingredients",
  "meal",
  "meals",
  "dish",
  "dishes",
  "meal plan",
  "meal plans",
  "meal planning",
  "meal prep",
  "grocery",
  "groceries",
  "shopping",
  "pantry",
  "fridge",
  "leftover",
  "leftovers",
  "snack",
  "snacks",
  "breakfast",
  "lunch",
  "dinner",
  "dessert",
  "drink",
  "drinks",
  "beverage",
  "coffee",
  "tea",
  "cocktail",
  "mocktail",
  "smoothie",
  "smoothies",
  "juice",
  "juices",
  "craving",
  "cravings",
  "hungry",
  "munchies",
  "snacky",
  "brekkie",
  "brunch",
  "protein",
  "macros",
  "calories",
  "nutrition",
  "diet",
  "diets",
  "vegan",
  "vegetarian",
  "pescatarian",
  "halal",
  "kosher",
  "keto",
  "ketogenic",
  "low-carb",
  "gluten-free",
  "gluten free",
  "dairy-free",
  "dairy free",
  "allergy",
  "allergies",
  "allergic",
  "intolerant",
  "substitution",
  "substitutions",
  "swap",
  "swaps",
  "soup",
  "salad",
  "sauce",
  "stir-fry",
  "marinade",
  "marinate",
  "season",
  "seasoning",
  "spice",
  "spices",
  "herb",
  "herbs",
  "bake",
  "baking",
  "roast",
  "roasting",
  "grill",
  "grilling",
  "fry",
  "frying",
  "boil",
  "simmer",
  "saute",
  "steam",
  "burger",
  "burgers",
  "pizza",
  "taco",
  "tacos",
  "sandwich",
  "sandwiches",
  "fries",
  "ramen",
  "sushi",
  "pancake",
  "pancakes",
  "curry",
  "stew",
  "bowl",
  "rice",
  "pasta",
  "noodles",
  "beans",
  "lentils",
  "chickpeas",
  "tofu",
  "tempeh",
  "chicken",
  "beef",
  "pork",
  "fish",
  "seafood",
  "egg",
  "eggs",
  "cheese",
  "yogurt",
  "butter",
  "milk",
  "cream",
  "tomato",
  "tomatoes",
  "onion",
  "garlic",
  "ginger",
  "lemon",
  "lime",
  "apple",
  "banana",
  "carrot",
  "potato",
  "spinach",
  "mushroom",
  "broccoli",
  "vegetable",
  "vegetables",
  "veggies",
  "fruit",
  "oven",
  "stove",
  "pan",
  "pot",
  "skillet",
  "air fryer",
  "airfryer",
];

export const TECH_BLOCKLIST = [
  "html",
  "css",
  "javascript",
  "js",
  "typescript",
  "ts",
  "react",
  "svelte",
  "vue",
  "next",
  "tailwind",
  "api",
  "endpoint",
  "server",
  "client",
  "deploy",
  "docker",
  "deno",
  "node",
  "python",
  "sql",
  "database",
  "schema",
  "uml",
  "mermaid",
  "github",
  "git",
];

const SMALL_TALK_RE =
  /^(hi|hello|hey|yo|sup|what'?s up|whats up|how are you|how'?s it going|thanks|thank you|ok|okay|cool|great|nice|awesome|sounds good|all good|lol|lmao|haha|nah|yep|yup|nope)$/i;
const FOOD_CONTEXT_RE =
  /\b(cook|cooking|recipe|meal|dish|ingredient|ingredients|diet|meal plan|meal prep|pantry|fridge|craving|hungry|dinner|lunch|breakfast|snack|dessert|drink|smoothie|curry|stew|bowl|pasta|rice|protein)\b/i;
const FOLLOW_UP_RE =
  /\b(that|those|this|one|ones|first|second|third|same|lighter|heavier|healthier|cozier|spicier|milder|quicker|faster|cheaper|protein|vegan|vegetarian|gluten|dairy|more|less|instead)\b/i;

function hasFoodHits(t: string) {
  return FOOD_ALLOWLIST.some((word) => t.includes(word));
}

export function isSmallTalk(s: string): boolean {
  return SMALL_TALK_RE.test(s.trim());
}

export function hasFoodSignal(s: string, lastAssistant = ""): boolean {
  const t = s.toLowerCase().trim();
  const mentionsFood = hasFoodHits(t);
  const mentionsTech = TECH_BLOCKLIST.some((word) => t.includes(word));

  if (mentionsFood) return true;

  if (
    /\b(i like|i love|i want|i need|i'm craving|im craving|craving|feel like)\b/
      .test(t) &&
    /\b(food|dish|meal|burger|pizza|taco|sandwich|pasta|rice|chicken|beef|fish|salad|soup|snack|dessert)\b/
      .test(t)
  ) {
    return true;
  }

  if (
    /\b(something|anything|give me|make me|help me pick)\b/.test(t) &&
    /\b(fresh|exotic|spicy|light|healthy|quick|comfort|cozy|hearty|cheap|budget)\b/
      .test(t)
  ) {
    return true;
  }

  const ingredientCue =
    /\b(i have|with|on hand|pantry|fridge|ingredients|leftovers|using)\b/.test(
      t,
    );
  const looksLikeIngredients =
    /\b(\d+|\d+\s*\/\s*\d+)\s*(g|kg|ml|l|cup|cups|tsp|tbsp|teaspoon|tablespoon)\b/
      .test(t) ||
    ((ingredientCue || /[,;\n]/.test(t)) && (mentionsFood || ingredientCue));
  if (looksLikeIngredients) return true;

  if (
    lastAssistant &&
    FOOD_CONTEXT_RE.test(lastAssistant) &&
    (t.length <= 160 || FOLLOW_UP_RE.test(t)) &&
    !isSmallTalk(t) &&
    !mentionsTech
  ) {
    return true;
  }

  return false;
}

export function buildConversationSteer(
  message: string,
  lastAssistant = "",
): string {
  const t = message.toLowerCase().trim();
  if (hasFoodSignal(t, lastAssistant)) return "";

  if (isSmallTalk(t)) {
    return [
      "The user is making casual small talk.",
      "Reply naturally in 1-2 sentences.",
      "Then gently bring it back to cravings, ingredients, diets, meal planning, or cooking help.",
      "Do not force a numbered list.",
    ].join("\n");
  }

  if (TECH_BLOCKLIST.some((word) => t.includes(word))) {
    return [
      "The user drifted into tech or app-building territory.",
      "Do not become a general coding assistant.",
      "Reply briefly and then redirect toward food, ingredients, diets, meal plans, or cooking.",
    ].join("\n");
  }

  return [
    "The user is off the main food topic.",
    "Reply briefly and warmly, then steer the conversation back to food, ingredients, diets, meal planning, or cooking.",
    "Keep the redirect natural rather than sounding like a refusal.",
  ].join("\n");
}
