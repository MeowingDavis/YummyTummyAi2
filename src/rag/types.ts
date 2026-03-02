export type RecipeRecord = {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  tags?: string[];
  cuisine?: string;
  source?: string;
};

export type RecipeHit = {
  recipe: RecipeRecord;
  score: number;
  why: string[];
};
