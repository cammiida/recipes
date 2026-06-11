import nbData from './recipes.nb.json';
import enText from './recipes.en.json';
import glossary from './glossary.json';
import type { Locale } from '../i18n';

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  weight_g?: number;
}

export interface Recipe {
  id: number;
  title: string;
  description: string;
  category: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  cook_time_min: number;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
}

/** Translatable text for one recipe, keyed by recipe id in recipes.en.json. */
interface RecipeText {
  title?: string;
  description?: string;
  steps?: string[];
  ingredients?: { name?: string; unit?: string }[];
}

const nbRecipes = (nbData as { recipes: Recipe[] }).recipes;
const enMap = enText as Record<string, RecipeText>;
const tagMap = (glossary as { tags: Record<string, string> }).tags;
const categoryMap = (glossary as { categories: Record<string, string> }).categories;

/**
 * Merge a Norwegian recipe with its English text. Numbers and structure always
 * come from the Norwegian source (so they cannot drift); only text is localized.
 * Any missing English text falls back to Norwegian.
 */
function localize(recipe: Recipe): Recipe {
  const text = enMap[String(recipe.id)] ?? {};
  return {
    ...recipe,
    title: text.title ?? recipe.title,
    description: text.description ?? recipe.description,
    category: categoryMap?.[recipe.category] ?? recipe.category,
    tags: recipe.tags.map((tag) => tagMap?.[tag] ?? tag),
    ingredients: recipe.ingredients.map((ing, i) => ({
      ...ing,
      name: text.ingredients?.[i]?.name ?? ing.name,
      unit: text.ingredients?.[i]?.unit ?? ing.unit,
    })),
    steps: text.steps ?? recipe.steps,
  };
}

export function getAllRecipes(locale: Locale): Recipe[] {
  return locale === 'en' ? nbRecipes.map(localize) : nbRecipes;
}

export function getRecipe(locale: Locale, id: string): Recipe | undefined {
  return getAllRecipes(locale).find((r) => String(r.id) === id);
}
