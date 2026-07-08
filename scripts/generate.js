// scripts/generate.js
// Главный конвейер генерации статей для всех активных сайтов.
// Текст: Cloudflare Worker (Llama 3) через scripts/article.js
// Картинки: DeepInfra (FLUX-1-schnell) через scripts/imagegen.js
// Хранение картинок: imgbb.com через scripts/imgbb.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { generateArticle } from "./article.js";
import { generateImage } from "./imagegen.js";
import { uploadToImgbb } from "./imgbb.js";
import { pickRefLink } from "./links.js";
import { getNicheKeywordIdeas } from "./keywords.js";
import { pickBannersHtml } from "./banners.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FALLBACK_REF_LINK = "https://www.creativefabrica.com/fonts/ref/8793785/?campaign=fonts2";

function loadSites() {
  const raw = fs.readFileSync(path.join(ROOT, "config", "sites.json"), "utf-8");
  return JSON.parse(raw);
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try { return yaml.load(match[1]); } catch { return null; }
}

function getExistingPosts(siteId) {
  const postsDir = path.join(ROOT, "sites", siteId, "posts");
  if (!fs.existsSync(postsDir)) return [];
  const posts = [];
  for (const file of fs.readdirSync(postsDir)) {
    if (!file.endsWith(".md")) continue;
    try {
      const content = fs.readFileSync(path.join(postsDir, file), "utf-8");
      const data = parseFrontMatter(content);
      if (data?.title && data?.permalink) {
        posts.push({ title: data.title, url: data.permalink.replace(/index\.html$/, "") });
      }
    } catch {}
  }
  return posts;
}

function makeUniqueSlug(baseSlug, postsDir) {
  if (!fs.existsSync(postsDir)) return baseSlug;
  const used = new Set();
  for (const file of fs.readdirSync(postsDir)) {
    if (!file.endsWith(".md")) continue;
    try {
      const content = fs.readFileSync(path.join(postsDir, file), "utf-8");
      const data = parseFrontMatter(content);
      if (data?.permalink) {
        const m = data.permalink.match(/^\/posts\/(.+)\/index\.html$/);
        if (m) used.add(m[1]);
      }
    } catch {}
  }
  if (!used.has(baseSlug)) return baseSlug;
  let i = 2;
  while (used.has(`${baseSlug}-${i}`)) i++;
  console.log(`  ⚠️ Slug "${baseSlug}" занят → использую "${baseSlug}-${i}"`);
  return `${baseSlug}-${i}`;
}

function ensureSiteScaffold(siteId) {
  const siteDir = path.join(ROOT, "sites", siteId);
  if (fs.existsSync(path.join(siteDir, ".eleventy.js"))) return;
  const templateDir = path.join(ROOT, "site-template");
  if (!fs.existsSync(templateDir)) return;
  copyDir(templateDir, siteDir, ["posts", "node_modules", "_site"]);
  fs.mkdirSync(path.join(siteDir, "posts"), { recursive: true });
  console.log(`[${siteId}] Шаблон скопирован.`);
}

function copyDir(src, dest, skip = []) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, skip);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
}

function buildFaqMarkdown(faq) {
  if (!Array.isArray(faq) || faq.length === 0) return "";
  return `\n\n## Frequently Asked Questions\n\n` +
    faq.map((f) => `### ${f.question}\n\n${f.answer}`).join("\n\n") + "\n";
}

function insertMiddle(body, imageMarkdown) {
  if (!imageMarkdown) return body;
  const parts = body.split(/\n\n/);
  const at = Math.floor(parts.length / 2);
  parts.splice(at, 0, imageMarkdown.trim());
  return parts.join("\n\n");
}

function saveArticle(site, article, images) {
  const dateStr = new Date().toISOString().split("T")[0];
  const postsDir = path.join(ROOT, "sites", site.id, "posts");
  const baseSlug = slugify(article.slug || article.title);
  const slug = makeUniqueSlug(baseSlug, postsDir);

  fs.mkdirSync(postsDir, { recursive: true });

  const altCover = article.image_alt_cover || article.title || "";
  const altBody = article.image_alt_body || article.title || "";

  const fmData = {
    layout: "post.njk",
    permalink: `/posts/${slug}/index.html`,
    title: article.title || "",
    date: dateStr,
    excerpt: article.excerpt || "",
    meta_description: article.meta_description || article.excerpt || "",
    image_alt: altCover,
    keywords: Array.isArray(article.keywords) ? article.keywords : [],
  };
  if (images.cover) fmData.image = images.cover;
  if (Array.isArray(article.faq) && article.faq.length > 0) {
    fmData.faq = article.faq.map((f) => ({ question: String(f.question || ""), answer: String(f.answer || "") }));
  }

  const fm = `---\n${yaml.dump(fmData, { lineWidth: -1 })}---\n\n`;
  const coverMd = images.cover ? `![${altCover}](${images.cover})\n\n` : "";
  const bodyMd = images.body ? insertMiddle(article.body_markdown || "", `![${altBody}](${images.body})`) : (article.body_markdown || "");
  const banners = pickBannersHtml(site.link_category, site.id, slug);
  const faqMd = buildFaqMarkdown(article.faq);

  fs.writeFileSync(path.join(postsDir, `${dateStr}-${slug}.md`), fm + coverMd + bodyMd + banners + faqMd, "utf-8");
  console.log(`[${site.id}] ✅ Сохранено: ${dateStr}-${slug}.md`);

  // Обновляем индекс внутренних ссылок
  const existing = getExistingPosts(site.id);
  const indexPath = path.join(ROOT, "sites", site.id, "internal-links-index.json");
  fs.writeFileSync(indexPath, JSON.stringify(existing, null, 2), "utf-8");
}

async function processSite(site) {
  console.log(`\n=== ${site.id} (${site.domain}) ===`);
  ensureSiteScaffold(site.id);

  const postsPerRun = site.posts_per_run || 1;

  for (let i = 0; i < postsPerRun; i++) {
    try {
      console.log(`[${site.id}] Получаю ключевые слова Google...`);
      const suggestedKeywords = await getNicheKeywordIdeas(site.niche).catch(() => []);
      if (suggestedKeywords.length > 0) console.log(`[${site.id}] Ключевые слова: ${suggestedKeywords.join(", ")}`);

      const existingPosts = getExistingPosts(site.id);
      const internalLinks = [...existingPosts].sort(() => Math.random() - 0.5).slice(0, 5);
      const todayStr = new Date().toISOString().split("T")[0];
      const refLink = pickRefLink(site.link_category, site.id, todayStr) || FALLBACK_REF_LINK;

      console.log(`[${site.id}] Генерирую статью (Llama 3)...`);
      const article = await generateArticle({
        niche: site.niche,
        lang: site.lang || "en",
        refLink,
        tone: site.tone,
        targetAudience: site.target_audience,
        writingStyle: site.writing_style,
        suggestedKeywords,
        existingTitles: existingPosts.map((p) => p.title),
        internalLinks,
        linkCategory: site.link_category,
      });
      console.log(`[${site.id}] Статья: "${article.title}"`);

      const images = { cover: null, body: null };

      try {
        console.log(`[${site.id}] Обложка: "${article.image_prompt_cover}"`);
        const buf = await generateImage(article.image_prompt_cover, site.image_style);
        images.cover = await uploadToImgbb(buf, `${site.id}-${slugify(article.slug || article.title)}-cover`);
        console.log(`[${site.id}] Обложка загружена: ${images.cover}`);
      } catch (e) {
        console.error(`[${site.id}] ⚠️ Обложка не сгенерирована: ${e.message}`);
      }

      try {
        const bodyPrompt = article.image_prompt_body || article.image_prompt_cover;
        console.log(`[${site.id}] Вторая картинка: "${bodyPrompt}"`);
        const buf = await generateImage(bodyPrompt, site.image_style);
        images.body = await uploadToImgbb(buf, `${site.id}-${slugify(article.slug || article.title)}-body`);
        console.log(`[${site.id}] Вторая картинка загружена: ${images.body}`);
      } catch (e) {
        console.error(`[${site.id}] ⚠️ Вторая картинка не сгенерирована: ${e.message}`);
      }

      saveArticle(site, article, images);
    } catch (err) {
      console.error(`[${site.id}] ❌ Ошибка: ${err.message}`);
    }
  }
}

async function main() {
  const sites = loadSites().filter((s) => s.active);
  console.log(`Активных сайтов: ${sites.length}`);
  for (const site of sites) await processSite(site);
  console.log("\n=== Готово ===");
}

main().catch((e) => { console.error("❌ Критическая ошибка:", e); process.exit(1); });
