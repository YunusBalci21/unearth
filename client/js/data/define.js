// Shared constructor for catalogue entries (used by catalog.js and the regional find lists).
//
// year: negative = BC.  rarity: common | uncommon | rare | legendary
// shape: key of a procedural model builder (see game/artifactModels.js)
// extra: { variant, pattern, accent, color, field }
//   field — what an excavator would write on the finds tag before the object is
//           identified (e.g. 'oil lamp'). Defaults to a description from shape + variant.

export const A = (id, name, shape, mat, rarity, year, period, culture, note, extra = {}) =>
    ({ id, name, shape, mat, rarity, year, period, culture, note, ...extra });
