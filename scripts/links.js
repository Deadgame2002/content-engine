// scripts/links.js
// Выбирает релевантную реф-ссылку Creative Fabrica по категории сайта
// из config/cf_links.json, чтобы статья ссылалась не на общую главную страницу,
// а на конкретную категорию товаров, близкую к теме ниши.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
 * Возвращает случайную ссылку из категории link_category.
 * Если категория не найдена или пуста — возвращает ссылку из "default".
 */
export function pickRefLink(linkCategory) {
  const links = loadLinks();
  const pool = links[linkCategory];

  if (Array.isArray(pool) && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const fallback = links.default;
  if (Array.isArray(fallback) && fallback.length > 0) {
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  // Крайний случай — если даже default не задан
  return "https://www.creativefabrica.com/?ref=8793785";
}
