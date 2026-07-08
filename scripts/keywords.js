// scripts/keywords.js
export async function getGoogleSuggestions(seedQuery) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seedQuery)}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.[1]) ? data[1].filter((s) => typeof s === "string") : [];
  } catch { return []; }
}

export async function getNicheKeywordIdeas(niche) {
  const seeds = [niche, `${niche} how to`, `best ${niche}`, `${niche} ideas`];
  const all = [];
  for (const seed of seeds) all.push(...await getGoogleSuggestions(seed));
  return [...new Set(all)].slice(0, 10);
}
