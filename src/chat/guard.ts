// src/chat/guard.ts

export const FOOD_ALLOWLIST = [
  "cook","cooking","recipe","recipes","ingredient","ingredients","meal","meals","dish","dishes",
  "bake","baking","roast","roasting","grill","grilling","fry","frying","boil","simmer","saute","steam",
  "soup","salad","sauce","stir-fry","marinade","marinate","season","spice","spices","herb","herbs",
  "breakfast","lunch","dinner","dessert","snack","drink","beverage","coffee","tea","cocktail","mocktail",
  "ideas","what should i cook","juice","juices","smoothie","smoothies","menu","restaurant","takeout", "salsa", "guacamole", "hummus", "dip", "dips",
  // dietary
  "vegan","vegetarian","gluten","dairy-free","nut-free","halal","kosher","low-carb","keto","pescatarian",
  // pantry/common
  "egg","eggs","flour","sugar","salt","pepper","oil","butter","milk","cream","cheese",
  "chicken","beef","pork","fish","tofu","tempeh","beans","rice","pasta","noodles","lentils","chickpeas",
  "quinoa","broth","stock","garlic","onion","tomato","tomatoes","ginger","lemon","lime",
  "apple","apples","banana","bananas","carrot","carrots","potato","potatoes","spinach","feta",
  "yogurt","oats","cinnamon","mushroom","mushrooms","broccoli","lettuce","vegetable","vegetables","veggies","fruit",
  // common foods / cravings
  "burger","burgers","pizza","taco","tacos","sandwich","sandwiches","fries","ramen","sushi","pancake","pancakes",
  // tools/gear
  "oven","stove","pan","pot","skillet","air fryer","airfryer","knife","cutting board"
];

export const TECH_BLOCKLIST = [
  "html","css","javascript","js","typescript","ts","react","svelte","vue","next","tailwind",
  "api","endpoint","server","client","deploy","docker","deno","node","python","sql","database","schema","uml","mermaid","github","git"
];

export function isCookingQuery(s: string, lastAssistant?: string): boolean {
  const t = s.toLowerCase();

  // 1) Hard block for tech unless food is also present
  const mentionsTech = TECH_BLOCKLIST.some(w => t.includes(w));
  const mentionsFood = FOOD_ALLOWLIST.some(w => t.includes(w));
  if (mentionsTech && !mentionsFood) return false;

  // 1b) Light small-talk passthrough
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|cool|great|nice|awesome|how are you|how's it going|whats up|what's up)$/i.test(t)) return true;

  // 2) Obvious food content
  if (mentionsFood) return true;

  // 2b) Food-intent conversational cues (e.g. "i like burger", "i'm craving pasta")
  if (/\b(i like|i love|i want|i'm craving|im craving|craving)\b/.test(t) && /\b(food|dish|meal|burger|pizza|taco|sandwich|pasta|rice|chicken|beef|fish|salad|soup|snack|dessert)\b/.test(t)) {
    return true;
  }

  // 3) Ingredient-like
  const ingredientCue = /\b(i have|with|on hand|pantry|fridge|ingredients|leftovers|using)\b/.test(t);
  const looksLikeIngredients =
    /\b(grams|g|kg|ml|l|cup|cups|tsp|tbsp|teaspoon|tablespoon)\b/.test(t) ||
    ((ingredientCue || /[,;\n]/.test(t)) && (mentionsFood || ingredientCue));
  if (looksLikeIngredients) return true;

  // 4) Contextual pass-through if last assistant was about cooking
  if (lastAssistant && /\b(cook|dish|meal|recipe|idea|juice|smoothie|soup|salad|quinoa|stew|bowl|curry|pilaf|chickpea|drink|snack|dinner|lunch|breakfast)\b/i.test(lastAssistant)) {
    return true;
  }

  return false;
}
