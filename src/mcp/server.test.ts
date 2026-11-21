import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRecipeMcpServer } from './server';
import { searchRecipes, listCategoriesAndTags } from './recipe-queries';
import { getAllRecipes } from '../data/recipes';
import { ALL as mcpRoute } from '../pages/api/mcp';

const ORIGIN = 'https://recipes.example.test';

function parseText(result: unknown): any {
  const [first] = (result as { content: { type: string; text: string }[] }).content;
  return JSON.parse(first.text);
}

describe('searchRecipes', () => {
  test('without filters returns the first page and the total count', () => {
    const result = searchRecipes({}, ORIGIN);
    expect(result.totalMatches).toBe(getAllRecipes('nb').length);
    expect(result.recipes).toHaveLength(10);
    expect(result.recipes[0].url).toBe(`${ORIGIN}/nb/recipe/1`);
  });

  test('every word in the query must match, case-insensitively', () => {
    const { recipes } = searchRecipes({ query: 'KYLLING pasta', limit: 50 }, ORIGIN);
    expect(recipes.map((r) => r.title)).toContain('Kremet pasta med kylling');
    for (const recipe of recipes) {
      const full = getAllRecipes('nb').find((r) => r.id === recipe.id)!;
      const text = JSON.stringify(full).toLowerCase();
      expect(text).toContain('kylling');
      expect(text).toContain('pasta');
    }
  });

  test('numeric filters are inclusive limits', () => {
    const { recipes } = searchRecipes(
      { max_calories: 500, min_protein_g: 40, max_cook_time_min: 30, limit: 50 },
      ORIGIN,
    );
    expect(recipes.length).toBeGreaterThan(0);
    for (const recipe of recipes) {
      expect(recipe.calories).toBeLessThanOrEqual(500);
      expect(recipe.protein_g).toBeGreaterThanOrEqual(40);
      expect(recipe.cook_time_min).toBeLessThanOrEqual(30);
    }
  });

  test('category and tags match in the requested locale', () => {
    const nb = searchRecipes({ category: 'middag', tags: ['fisk'], limit: 50 }, ORIGIN);
    const en = searchRecipes({ locale: 'en', category: 'Dinner', tags: ['Fish'], limit: 50 }, ORIGIN);
    expect(nb.totalMatches).toBeGreaterThan(0);
    expect(en.recipes.map((r) => r.id)).toEqual(nb.recipes.map((r) => r.id));
  });
});

describe('listCategoriesAndTags', () => {
  test('category counts add up to the number of recipes', () => {
    const { categories } = listCategoriesAndTags('nb');
    const total = Object.values(categories).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(getAllRecipes('nb').length);
  });
});

describe('recipe MCP server', () => {
  const client = new Client({ name: 'test-client', version: '1.0.0' });

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createRecipeMcpServer(ORIGIN).connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(() => client.close());

  test('exposes three read-only tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_recipe',
      'list_recipe_categories_and_tags',
      'search_recipes',
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  test('get_recipe returns English text with ingredients and steps', async () => {
    const result = await client.callTool({ name: 'get_recipe', arguments: { id: 1, locale: 'en' } });
    const recipe = parseText(result);
    expect(recipe.url).toBe(`${ORIGIN}/en/recipe/1`);
    expect(recipe.ingredients.length).toBeGreaterThan(0);
    expect(recipe.steps.length).toBeGreaterThan(0);
    expect(recipe.title).not.toBe('Kremet pasta med kylling');
  });

  test('get_recipe defaults to Norwegian', async () => {
    const result = await client.callTool({ name: 'get_recipe', arguments: { id: 1 } });
    expect(parseText(result).title).toBe('Kremet pasta med kylling');
  });

  test('get_recipe reports an unknown id as a tool error', async () => {
    const result = await client.callTool({ name: 'get_recipe', arguments: { id: 99999 } });
    expect(result.isError).toBe(true);
  });
});

describe('/api/mcp route', () => {
  async function post(body: unknown): Promise<Response> {
    const request = new Request(`${ORIGIN}/api/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
      },
      body: JSON.stringify(body),
    });
    // The route only reads `request` and `url` from the Astro context.
    return mcpRoute({ request, url: new URL(request.url) } as never) as Promise<Response>;
  }

  test('rejects GET because the stateless server has no stream to open', async () => {
    const request = new Request(`${ORIGIN}/api/mcp`, { headers: { accept: 'text/event-stream' } });
    const response = await mcpRoute({ request, url: new URL(request.url) } as never);
    expect(response.status).toBe(405);
  });

  test('answers initialize and tools/call over stateless JSON', async () => {
    const init = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    });
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe('recipes');

    const call = await post({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'search_recipes', arguments: { query: 'kylling', limit: 3 } },
    });
    expect(call.status).toBe(200);
    const search = parseText((await call.json()).result);
    expect(search.recipes.length).toBeGreaterThan(0);
    expect(search.recipes[0].url.startsWith(`${ORIGIN}/nb/recipe/`)).toBe(true);
  });
});
