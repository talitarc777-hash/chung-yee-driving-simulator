/** Some LandsD f2 payloads reference KTX2 through core texture.source.
 * Three.js selects its Basis decoder only through KHR_texture_basisu.
 * Adapt the in-memory document; preserve source imagery and texture indices.
 */
export function normalizeLandsDKtx2(json: {
  images?: { mimeType?: string }[];
  textures?: { source?: number; extensions?: Record<string, unknown> }[];
  extensionsUsed?: string[];
}) {
  let adapted = 0;
  for (const texture of json.textures || []) {
    if (texture.source === undefined ||
        json.images?.[texture.source]?.mimeType !== "image/ktx2" ||
        texture.extensions?.KHR_texture_basisu) continue;
    texture.extensions = { ...texture.extensions,
      KHR_texture_basisu: { source: texture.source } };
    adapted++;
  }
  if (adapted && !json.extensionsUsed?.includes("KHR_texture_basisu"))
    (json.extensionsUsed ||= []).push("KHR_texture_basisu");
  return adapted;
}
