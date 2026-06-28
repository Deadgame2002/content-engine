// scripts/banners.js
// Выбирает HTML-баннеры Creative Fabrica для вставки в конец статьи:
// 1 баннер, релевантный нише сайта (если есть для категории) + универсальный баннер,
// который ставится на каждую статью независимо от ниши.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { addUtm } from "./utm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let cachedBanners = null;

function loadBanners() {
  if (cachedBanners) return cachedBanners;
  const configPath = path.join(ROOT, "config", "cf_banners.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  cachedBanners = JSON.parse(raw);
  return cachedBanners;
}

function pickRandom(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Добавляет UTM-метку к href внутри HTML-баннера (ищет href="...", дописывает параметры).
 */
function addUtmToBannerHtml(html, siteId, postSlug) {
  return html.replace(/href="([^"]+)"/, (match, url) => {
    return `href="${addUtm(url, siteId, postSlug)}"`;
  });
}

/**
 * Возвращает HTML-блок с баннерами для вставки в статью:
 * - 1 баннер из категории link_category (если есть подходящие)
 * - универсальный баннер Creative Fabrica (всегда)
 */
export function pickBannersHtml(linkCategory, siteId, postSlug) {
  const banners = loadBanners();

  const categoryBanner = pickRandom(banners[linkCategory]);
  const universalBanner = pickRandom(banners.universal);

  const parts = [];
  if (categoryBanner) parts.push(addUtmToBannerHtml(categoryBanner, siteId, postSlug));
  if (universalBanner) parts.push(addUtmToBannerHtml(universalBanner, siteId, postSlug));

  if (parts.length === 0) return "";

  return `\n\n<div class="cf-banners-block">\n${parts.join("\n")}\n</div>\n`;
}
