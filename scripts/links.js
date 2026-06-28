// scripts/links.js
// Выбирает релевантную реф-ссылку Creative Fabrica по категории сайта
// из config/cf_links.json, чтобы статья ссылалась не на общую главную страницу,
// а на конкретную категорию товаров, близкую к теме ниши.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { addUtm } from "./utm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let cachedLinks = null;

function loadLinks() {
  if (cachedLinks) return cachedLinks;
  const configPath = path.join(ROOT, "config", "cf_links.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  cachedLinks = JSON.parse(raw);
  return cachedLinks;
}

/**
 * Возвращает случайную ссылку из категории link_category, с добавленной UTM-меткой
 * (если переданы siteId/postSlug — для собственной аналитики кликов).
 * Если категория не найдена или пуста — возвращает ссылку из "default".
 */
export function pickRefLink(linkCategory, siteId, postSlug) {
  const links = loadLinks();
  const pool = links[linkCategory];

  let chosen;
  if (Array.isArray(pool) && pool.length > 0) {
    chosen = pool[Math.floor(Math.random() * pool.length)];
  } else {
    const fallback = links.default;
    chosen =
      Array.isArray(fallback) && fallback.length > 0
        ? fallback[Math.floor(Math.random() * fallback.length)]
        : "https://www.creativefabrica.com/fonts/ref/8793785/?campaign=fonts2";
  }

  return siteId ? addUtm(chosen, siteId, postSlug) : chosen;
}
