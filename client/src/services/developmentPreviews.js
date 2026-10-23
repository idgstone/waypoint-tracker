export function developmentPreviewsEnabled(env) {
  return env?.DEV === true && env.VITE_ENABLE_PREVIEWS === "true";
}
export const previewsEnabled = developmentPreviewsEnabled(import.meta.env);
