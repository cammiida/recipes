import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

interface SeedUser {
  email: string;
  password: string;
  name: string;
}

interface JsonRecipe {
  id: number;
  title: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: { name: string; amount: number; unit: string; weight_g?: number }[];
  steps: string[];
  tags: string[];
  category: string;
  cook_time_min: number;
}

function loadUsers(path: string): SeedUser[] {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

function loadRecipes(path: string): JsonRecipe[] {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw).recipes;
}

async function seedUsers(usersPath: string) {
  const users = loadUsers(usersPath);

  for (const user of users) {
    const existing = await auth.api.signInEmail({
      body: { email: user.email, password: user.password },
      asResponse: true,
    });

    if (existing.status === 200) {
      console.log(`User already exists: ${user.email}`);
      continue;
    }

    await auth.api.signUpEmail({
      body: {
        email: user.email,
        password: user.password,
        name: user.name,
      },
    });

    console.log(`User created: ${user.email}`);
  }
}

async function seedRecipes(recipesPath: string) {
  const recipes = loadRecipes(recipesPath);
  let created = 0;
  let skipped = 0;

  for (const recipe of recipes) {
    const existing = await prisma.recipe.findFirst({
      where: { title: recipe.title },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.recipe.create({
      data: {
        title: recipe.title,
        description: recipe.description,
        category: recipe.category,
        cookTimeMin: recipe.cook_time_min,
        kcal: recipe.calories,
        proteinG: recipe.protein_g,
        carbsG: recipe.carbs_g,
        fatG: recipe.fat_g,
        tags: recipe.tags,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
      },
    });

    created++;
  }

  console.log(`Recipes: ${created} created, ${skipped} already existed`);
}

interface SeedOptions {
  usersPath?: string;
  recipesPath?: string;
  skipUsers?: boolean;
  skipRecipes?: boolean;
}

export async function seed(options: SeedOptions = {}) {
  const {
    usersPath = resolve(import.meta.dirname!, "seed-users.json"),
    recipesPath = resolve(import.meta.dirname!, "../recipes.json"),
    skipUsers = false,
    skipRecipes = false,
  } = options;

  if (!skipUsers) await seedUsers(usersPath);
  if (!skipRecipes) await seedRecipes(recipesPath);
}

const isDirectRun =
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js");

if (isDirectRun) {
  seed();
}
