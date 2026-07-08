// scripts/links.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { addUtm } from "./utm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
let cache = null;

function load() {
  if (cache) return cache;
  cache = JSON.parse(fs.readFileSync(path.join(ROOT, "config", "cf_links.json"), "utf-8"));
  return cache;
}

export function pickRefLink(category, siteId, slug) {
  const links = load();
  const pool = links[category] || links.default || ["https://www.creativefabrica.com/ref/8793785/"];
  const url = pool[Math.floor(Math.random() * pool.length)];
  return siteId ? addUtm(url, siteId, slug) : url;
}
