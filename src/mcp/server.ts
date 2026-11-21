import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getRecipeWithUrl,
  listCategoriesAndTags,
  localeSchema,
  searchRecipes,
  searchRecipesInputSchema,
} from './recipe-queries';

const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

function jsonResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

/**
 * Build a read-only MCP server over the recipe collection.
 * `siteOrigin` (e.g. "https://recipes.cmd.fyi") is used to link each recipe to its page.
 */
export function createRecipeMcpServer(siteOrigin: string): McpServer {
  const server = new McpServer(
    { name: 'recipes', version: '1.0.0' },
    {
      instructions:
        'High-protein recipes, each standardized to one portion, with calories and macros. ' +
        'Use list_recipe_categories_and_tags to see filter values, search_recipes to find ' +
        'recipes, and get_recipe for ingredients and steps.',
    },
  );

  server.registerTool(
    'search_recipes',
    {
      title: 'Search recipes',
      description:
        'Find recipes by free text and/or filters. Returns summaries (no ingredients or steps). ' +
        'Category and tag values must be in the chosen locale.',
      inputSchema: searchRecipesInputSchema,
      annotations: readOnly,
    },
    async (input) => jsonResult(searchRecipes(input, siteOrigin)),
  );

  server.registerTool(
    'get_recipe',
    {
      title: 'Get recipe',
      description: 'Get one recipe with ingredients (amount, unit, weight) and steps.',
      inputSchema: {
        id: z.number().int().positive().describe('Recipe id from search_recipes.'),
        locale: localeSchema,
      },
      annotations: readOnly,
    },
    async ({ id, locale }) => {
      const recipe = getRecipeWithUrl(locale, id, siteOrigin);
      if (!recipe) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `No recipe with id ${id}.` }],
        };
      }
      return jsonResult(recipe);
    },
  );

  server.registerTool(
    'list_recipe_categories_and_tags',
    {
      title: 'List categories and tags',
      description: 'List every category and tag with how many recipes have it.',
      inputSchema: { locale: localeSchema },
      annotations: readOnly,
    },
    async ({ locale }) => jsonResult(listCategoriesAndTags(locale)),
  );

  return server;
}
