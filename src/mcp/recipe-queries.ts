import { z } from 'zod';
import { getAllRecipes, getRecipe, type Recipe } from '../data/recipes';
import { locales, type Locale } from '../i18n';

export const DEFAULT_SEARCH_LIMIT = 10;

export const localeSchema = z
  .enum(locales)
  .default('nb')
  .describe('Language of the returned text: "nb" (Norwegian, the source) or "en" (English).');

/**
 * Input of the search_recipes tool. It is the single source for the tool's JSON
 * schema and for the TypeScript types below, so the two cannot drift apart.
 */
export const searchRecipesInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Words that must all appear in the title, description, ingredients or tags.'),
  category: z.string().optional().describe('For example "middag" (nb) or "dinner" (en).'),
  tags: z.array(z.string()).optional().describe('Recipe must have every one of these tags.'),
  max_calories: z.number().int().positive().optional().describe('Upper limit in kcal per portion.'),
  min_protein_g: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Lower limit for protein per portion.'),
  max_cook_time_min: z.number().int().positive().optional().describe('Upper limit for cooking time.'),
  limit: z.number().int().min(1).max(50).default(DEFAULT_SEARCH_LIMIT),
  locale: localeSchema,
});

/** What a caller may pass: `limit` and `locale` are optional and get their defaults. */
export type SearchRecipesInput = z.input<typeof searchRecipesInputSchema>;
/** After parsing: defaults are filled in. */
type ParsedSearchRecipesInput = z.output<typeof searchRecipesInputSchema>;

/** The fields an MCP client needs to pick a recipe, without ingredients and steps. */
export interface RecipeSummary {
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
  url: string;
}

export function recipeUrl(siteOrigin: string, locale: Locale, id: number): string {
  return `${siteOrigin}/${locale}/recipe/${id}`;
}

function normalize(text: string): string {
  return text.toLocaleLowerCase('nb');
}

function searchableText(recipe: Recipe): string {
  return normalize(
    [
      recipe.title,
      recipe.description,
      recipe.category,
      ...recipe.tags,
      ...recipe.ingredients.map((ingredient) => ingredient.name),
    ].join(' '),
  );
}

function matchesFilters(recipe: Recipe, filters: ParsedSearchRecipesInput): boolean {
  if (filters.category && normalize(recipe.category) !== normalize(filters.category)) {
    return false;
  }
  if (filters.tags?.length) {
    const recipeTags = new Set(recipe.tags.map(normalize));
    if (!filters.tags.every((tag) => recipeTags.has(normalize(tag)))) {
      return false;
    }
  }
  if (filters.max_calories !== undefined && recipe.calories > filters.max_calories) {
    return false;
  }
  if (filters.min_protein_g !== undefined && recipe.protein_g < filters.min_protein_g) {
    return false;
  }
  if (filters.max_cook_time_min !== undefined && recipe.cook_time_min > filters.max_cook_time_min) {
    return false;
  }
  if (filters.query?.trim()) {
    const haystack = searchableText(recipe);
    const words = normalize(filters.query).split(/\s+/).filter(Boolean);
    if (!words.every((word) => haystack.includes(word))) {
      return false;
    }
  }
  return true;
}

export function toRecipeSummary(recipe: Recipe, locale: Locale, siteOrigin: string): RecipeSummary {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    category: recipe.category,
    calories: recipe.calories,
    protein_g: recipe.protein_g,
    carbs_g: recipe.carbs_g,
    fat_g: recipe.fat_g,
    cook_time_min: recipe.cook_time_min,
    tags: recipe.tags,
    url: recipeUrl(siteOrigin, locale, recipe.id),
  };
}

export function searchRecipes(
  input: SearchRecipesInput,
  siteOrigin: string,
): { totalMatches: number; recipes: RecipeSummary[] } {
  // Parsing here applies the schema's defaults and limits for every caller, not only MCP.
  const filters = searchRecipesInputSchema.parse(input);
  const matches = getAllRecipes(filters.locale).filter((recipe) => matchesFilters(recipe, filters));
  return {
    totalMatches: matches.length,
    recipes: matches
      .slice(0, filters.limit)
      .map((recipe) => toRecipeSummary(recipe, filters.locale, siteOrigin)),
  };
}

export function getRecipeWithUrl(
  locale: Locale,
  id: number,
  siteOrigin: string,
): (Recipe & { url: string }) | undefined {
  const recipe = getRecipe(locale, String(id));
  return recipe && { ...recipe, url: recipeUrl(siteOrigin, locale, recipe.id) };
}

/** Category and tag values with recipe counts, so a client knows which filters exist. */
export function listCategoriesAndTags(locale: Locale): {
  categories: Record<string, number>;
  tags: Record<string, number>;
} {
  const categories: Record<string, number> = {};
  const tags: Record<string, number> = {};
  for (const recipe of getAllRecipes(locale)) {
    categories[recipe.category] = (categories[recipe.category] ?? 0) + 1;
    for (const tag of recipe.tags) {
      tags[tag] = (tags[tag] ?? 0) + 1;
    }
  }
  return { categories, tags };
}
