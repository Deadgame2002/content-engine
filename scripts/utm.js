// scripts/utm.js
// Добавляет наши собственные UTM-метки к ссылкам Creative Fabrica,
// чтобы потом можно было увидеть в Google Analytics/любом трекере, с какого именно
// сайта и поста пришёл клик. Партнёрский параметр campaign=... (от самой Creative Fabrica)
// не трогаем — он остаётся как есть, просто добавляем свои utm_* параметры через "&".

/**
 * @param {string} url - исходная ссылка (с ?campaign=... или без)
 * @param {string} siteId - id сайта (например "site1")
 * @param {string} postSlug - slug статьи, на которой стоит ссылка
 */
export function addUtm(url, siteId, postSlug) {
  if (!url) return url;

  const separator = url.includes("?") ? "&" : "?";
  const utmParams = [
    "utm_source=" + encodeURIComponent(siteId || "site"),
    "utm_medium=blog",
    "utm_campaign=" + encodeURIComponent(postSlug || "post"),
  ].join("&");

  return `${url}${separator}${utmParams}`;
}
