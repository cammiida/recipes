/** Eagerly import all recipe images from src/assets/images/. */
const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/images/recipe-*.jpg',
  { eager: true },
);

/** Map from recipe id to its resolved ImageMetadata (or undefined). */
const imageMap = new Map<number, ImageMetadata>();

for (const [path, mod] of Object.entries(imageModules)) {
  const match = path.match(/recipe-(\d+)\.jpg$/);
  if (match) {
    imageMap.set(Number(match[1]), mod.default);
  }
}

export function getRecipeImage(id: number): ImageMetadata | undefined {
  return imageMap.get(id);
}
