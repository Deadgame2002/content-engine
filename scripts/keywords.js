// scripts/keywords.js
// Бесплатный способ узнать, что реально ищут люди — Google Autocomplete (suggestqueries).
// Никакого ключа не нужно, это тот же сервис, что подсказки в строке поиска Google.

/**
 * Возвращает массив строк-подсказок Google по запросу (обычно 5-10 штук).
 * Если запрос к Google не удался (сеть, лимиты) — возвращает пустой массив,
 * чтобы не ломать основную генерацию статьи.
 */
export async function getGoogleSuggestions(seedQuery) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seedQuery)}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    // Формат ответа: [query, [подсказка1, подсказка2, ...]]
    const suggestions = Array.isArray(data?.[1]) ? data[1] : [];
    return suggestions.filter((s) => typeof s === "string");
  } catch {
    return [];
  }
}

/**
 * Берёт нишу сайта, формирует несколько "затравок" (niche + "how to", "best", "ideas" и т.д.)
 * и собирает реальные подсказки Google по каждой — получается небольшой список того,
 * что люди реально вводят в поиск прямо сейчас по теме.
 */
export async function getNicheKeywordIdeas(niche) {
  const seeds = [niche, `${niche} how to`, `${niche} ideas`, `best ${niche}`];

  const all = [];
  for (const seed of seeds) {
    const suggestions = await getGoogleSuggestions(seed);
    all.push(...suggestions);
  }

  // Убираем дубли, ограничиваем до 10 штук, чтобы не перегружать промпт
  const unique = [...new Set(all)];
  return unique.slice(0, 10);
}
