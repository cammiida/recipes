import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, test, expect, afterAll } from "vitest";
import { auth } from "./auth";
import { prisma } from "./prisma";
import type { Recipe } from "@prisma/client";

const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: "test-password-123",
  name: "Test User",
};

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_USER.email } });
  await prisma.$disconnect();
});

describe("session validation", () => {
  test("returns null for unauthenticated request", async () => {
    const session = await auth.api.getSession({
      headers: new Headers(),
    });

    expect(session).toBeNull();
  });

  test("returns user data for authenticated request", async () => {
    await auth.api.signUpEmail({
      body: TEST_USER,
    });

    const signInResponse = await auth.api.signInEmail({
      body: { email: TEST_USER.email, password: TEST_USER.password },
      asResponse: true,
    });

    const sessionCookie = signInResponse.headers.get("set-cookie");
    expect(sessionCookie).toBeTruthy();

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookie! }),
    });

    expect(session).not.toBeNull();
    expect(session!.user.email).toBe(TEST_USER.email);
    expect(session!.user.name).toBe(TEST_USER.name);
  });

  test("sign-out invalidates session", async () => {
    const signInResponse = await auth.api.signInEmail({
      body: { email: TEST_USER.email, password: TEST_USER.password },
      asResponse: true,
    });

    const sessionCookie = signInResponse.headers.get("set-cookie")!;

    await auth.api.signOut({
      headers: new Headers({ cookie: sessionCookie }),
    });

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookie }),
    });

    expect(session).toBeNull();
  });

  test("rejects invalid credentials", async () => {
    const response = await auth.api.signInEmail({
      body: { email: TEST_USER.email, password: "wrong-password" },
      asResponse: true,
    });

    expect(response.status).toBe(401);

    const sessionCookie = response.headers.get("set-cookie");
    expect(sessionCookie).toBeNull();
  });
});

describe("seed script", () => {
  const SEED_USER = {
    email: `seed-${Date.now()}@example.com`,
    password: "seed-test-password",
    name: "Seed User",
  };

  const seedFile = join(tmpdir(), `seed-users-${Date.now()}.json`);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: SEED_USER.email } });
    try { unlinkSync(seedFile); } catch {}
  });

  test("creates accounts from seed-users file", async () => {
    writeFileSync(seedFile, JSON.stringify([SEED_USER]));

    const { seed } = await import("../../prisma/seed");
    await seed({ usersPath: seedFile });

    const user = await prisma.user.findUnique({
      where: { email: SEED_USER.email },
    });
    expect(user).not.toBeNull();
    expect(user!.name).toBe(SEED_USER.name);

    const signInResponse = await auth.api.signInEmail({
      body: { email: SEED_USER.email, password: SEED_USER.password },
      asResponse: true,
    });
    expect(signInResponse.status).toBe(200);
  });
});

describe("recipe seed", () => {
  const RECIPE_TITLE = `test-recipe-${Date.now()}`;
  const recipesFile = join(tmpdir(), `recipes-${Date.now()}.json`);

  const testRecipeJson = {
    meta: { source: "test" },
    recipes: [
      {
        id: 999,
        title: RECIPE_TITLE,
        description: "A test recipe",
        calories: 500,
        protein_g: 30,
        carbs_g: 40,
        fat_g: 20,
        ingredients: [
          { name: "Test Ingredient", amount: 100, unit: "g" },
          { name: "Other Ingredient", amount: 2, unit: "dl", weight_g: 50 },
        ],
        steps: ["Step one", "Step two"],
        tags: ["test", "tdd"],
        category: "middag",
        cook_time_min: 15,
      },
    ],
  };

  afterAll(async () => {
    await prisma.recipe.deleteMany({ where: { title: RECIPE_TITLE } });
    try { unlinkSync(recipesFile); } catch {}
  });

  test("inserts recipes with correct field mapping", async () => {
    writeFileSync(recipesFile, JSON.stringify(testRecipeJson));

    const { seed } = await import("../../prisma/seed");
    await seed({ recipesPath: recipesFile, skipUsers: true });

    const recipe = await prisma.recipe.findFirst({
      where: { title: RECIPE_TITLE },
    });

    expect(recipe).not.toBeNull();
    const r = recipe as Recipe;
    expect(r.kcal).toBe(500);
    expect(r.proteinG).toBe(30);
    expect(r.carbsG).toBe(40);
    expect(r.fatG).toBe(20);
    expect(r.cookTimeMin).toBe(15);
    expect(r.category).toBe("middag");
    expect(r.tags).toEqual(["test", "tdd"]);
    expect(r.ingredients).toEqual(testRecipeJson.recipes[0].ingredients);
    expect(r.steps).toEqual(["Step one", "Step two"]);
  });

  test("is idempotent — running twice does not create duplicates", async () => {
    const { seed } = await import("../../prisma/seed");
    await seed({ recipesPath: recipesFile, skipUsers: true });

    const recipes = await prisma.recipe.findMany({
      where: { title: RECIPE_TITLE },
    });

    expect(recipes).toHaveLength(1);
  });
});
