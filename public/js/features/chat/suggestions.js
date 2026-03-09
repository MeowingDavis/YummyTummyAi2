// public/js/features/chat/suggestions.js

export const SUGGESTIONS = [
  "What can I cook with eggs, spinach, and feta?",
  "What are some simple meals I can cook on a budget",
  "Make a 20-minute vegan dinner plan.",
  "Turn these leftovers into lunch: chicken, rice, broccoli.",
  "Low-sodium pasta sauce ideas.",
  "Gluten-free dessert with 5 ingredients.",
  "Meal prep for 3 days under 1500 kcal/day.",
  "High-protein breakfast without protein powder.",
  "One-pot dinner with quinoa and veggies.",
  "Kid-friendly vegetarian dinner this week.",
  "Dairy-free creamy pasta alternatives.",
  "Quick sauces to level up grilled chicken.",
  "How to use up wilting herbs (parsley, cilantro).",
  "Pantry-only dinner: canned beans, tomatoes, pasta.",
  "Budget dinner for 4 under $15.",
  "Air-fryer ideas for salmon & potatoes.",
  "Make a spice blend for roasted veggies.",
  "Weeknight curry with coconut milk and tofu.",
  "Indian-inspired lentil meal in 25 minutes.",
  "Low-waste tips to store cut onions and herbs.",
  "Pairing ideas for roast pumpkin (sides & sauces)."
];

export function sample(array, k = 4) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}
