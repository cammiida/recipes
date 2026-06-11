import { describe, test, expect } from "vitest";
import nb from "./nb.json";
import en from "./en.json";
import { t, locales, defaultLocale } from "./index";

describe("t()", () => {
  test("returns the string for the requested locale", () => {
    expect(t("nb", "siteTitle")).toBe("Oppskrifter");
    expect(t("en", "siteTitle")).toBe("Recipes");
  });

  test("falls back to the default locale for a missing key", () => {
    // @ts-expect-error — exercising a key that only exists at runtime
    expect(t("en", "doesNotExist")).toBe(t(defaultLocale, "doesNotExist"));
  });
});

describe("dictionaries", () => {
  test("nb is the default locale", () => {
    expect(defaultLocale).toBe("nb");
    expect(locales).toEqual(["nb", "en"]);
  });

  test("every locale defines the same keys (no missing translations)", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(nb).sort());
  });
});
