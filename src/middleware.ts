import { defineMiddleware } from "astro:middleware";
import { middleware } from "astro:i18n";

// Built-in i18n routing for the public, localized site.
// Mirrors the previous `routing: { prefixDefaultLocale: true }` config.
const i18n = middleware({
  prefixDefaultLocale: true,
  redirectToDefaultLocale: true,
  fallbackType: "redirect",
});

// Routes that are intentionally locale-agnostic (auth + admin + API).
// These bypass i18n so they resolve at their literal paths instead of 404ing.
const NON_LOCALIZED = ["/login", "/admin", "/api"];

export const onRequest = defineMiddleware((ctx, next) => {
  const path = ctx.url.pathname;
  // The root page redirects to the default locale itself (see src/pages/index.astro),
  // so it must bypass i18n to be prerendered into dist/client/index.html for the
  // static deploy. This matches the home-page exception of automatic i18n routing.
  if (path === "/") {
    return next();
  }
  if (NON_LOCALIZED.some((p) => path === p || path.startsWith(p + "/"))) {
    return next();
  }
  return i18n(ctx, next);
});
