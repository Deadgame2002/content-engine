// scripts/banners.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { addUtm } from "./utm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
let cache = null;

function load() {
  if (cache) return cache;
  cache = JSON.parse(fs.readFileSync(path.join(ROOT, "config", "cf_banners.json"), "utf-8"));
  return cache;
}

function pick(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function addUtmToHtml(html, siteId, slug) {
  return html.replace(/href="([^"]+)"/, (_, url) => `href="${addUtm(url, siteId, slug)}"`);
}

export function pickBannersHtml(category, siteId, slug) {
  const banners = load();
  const cat = pick(banners[category]);
  const uni = pick(banners.universal);
  const parts = [];
  if (cat) parts.push(addUtmToHtml(cat, siteId, slug));
  if (uni) parts.push(addUtmToHtml(uni, siteId, slug));
  if (parts.length === 0) return "";
  return `\n\n<div class="cf-banners-block">\n${parts.join("\n")}\n</div>\n`;
}
