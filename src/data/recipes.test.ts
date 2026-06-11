import { describe, test, expect } from "vitest";
import { getAllRecipes, getRecipe } from "./recipes";
import nbData from "./recipes.nb.json";

const nbRecipes = (nbData as { recipes: { id: number }[] }).recipes;

describe("getAllRecipes", () => {
  test("returns the Norwegian source unchanged for nb", () => {
    const nb = getAllRecipes("nb");
    expect(nb.length).toBe(nbRecipes.length);
    expect(nb[0].title).toBe("Kremet pasta med kylling");
  });

  test("localizes text but keeps numbers and structure for en", () => {
    const nb = getAllRecipes("nb");
    const en = getAllRecipes("en");

    expect(en.length).toBe(nb.length);

    en.forEach((enRecipe, i) => {
      const nbRecipe = nb[i];
      // Numbers come from the Norwegian source — they must never diverge.
      expect(enRecipe.calories).toBe(nbRecipe.calories);
      expect(enRecipe.protein_g).toBe(nbRecipe.protein_g);
      expect(enRecipe.cook_time_min).toBe(nbRecipe.cook_time_min);
      // Structure is preserved.
      expect(enRecipe.ingredients.length).toBe(nbRecipe.ingredients.length);
      expect(enRecipe.steps.length).toBe(nbRecipe.steps.length);
    });
  });

  test("translates the first recipe into English", () => {
    const recipe = getRecipe("en", "1");
    expect(recipe?.title).toBe("Creamy pasta with chicken");
    expect(recipe?.tags).toContain("chicken");
    expect(recipe?.category).toBe("dinner");
  });

  test("getRecipe returns undefined for an unknown id", () => {
    expect(getRecipe("nb", "999999")).toBeUndefined();
  });
});
