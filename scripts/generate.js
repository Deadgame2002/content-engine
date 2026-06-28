// scripts/generate.js
// Главный конвейер: для каждого активного сайта из config/sites.json
// 1. Генерирует статью через DeepSeek
// 2. Генерирует обложку через Cloudflare Worker
// 3. Загружает обложку на imgbb
// 4. Сохраняет .md файл статьи (с картинкой с imgbb и реф-ссылкой) в sites/<id>/posts/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateArticle } from "./deepseek.js";
import { generateImage } from "./imagegen.js";
import { uploadToImgbb } from "./imgbb.js";
import { pickRefLink } from "./links.js";
import { getNicheKeywordIdeas } from "./keywords.js";
import { pickBannersHtml } from "./banners.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Резервная ссылка, если для сайта не задана категория или конфиг ссылок пуст
const FALLBACK_REF_LINK = "https://www.creativefabrica.com/ref/8793785/";

function copyTemplateRecursive(src, dest, skipDirs = []) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skipDirs.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTemplateRecursive(srcPath, destPath, skipDirs);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function ensureSiteScaffold(siteId) {
  const siteDir = path.join(ROOT, "sites", siteId);
  const eleventyConfigPath = path.join(siteDir, ".eleventy.js");

  if (fs.existsSync(eleventyConfigPath)) return; // уже инициализирован

  console.log(`[${siteId}] Папка сайта не найдена — копирую шаблон 11ty из site-template/...`);
  const templateDir = path.join(ROOT, "site-template");
  copyTemplateRecursive(templateDir, siteDir, ["posts", "node_modules", "_site"]);

  const postsDir = path.join(siteDir, "posts");
  fs.mkdirSync(postsDir, { recursive: true });

  console.log(`[${siteId}] Шаблон скопирован в sites/${siteId}/`);
}

function loadSites() {
  const configPath = path.join(ROOT, "config", "sites.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function getExistingTitles(siteId) {
  return getExistingPosts(siteId).map((p) => p.title);
}

function getExistingPosts(siteId) {
  const postsDir = path.join(ROOT, "sites", siteId, "posts");
  if (!fs.existsSync(postsDir)) return [];

  const posts = [];
  for (const file of fs.readdirSync(postsDir)) {
    if (!file.endsWith(".md")) continue;
    try {
      const content = fs.readFileSync(path.join(postsDir, file), "utf-8");
      const titleMatch = content.match(/^title:\s*"(.+)"$/m);
      const permalinkMatch = content.match(/^permalink:\s*"(.+)"$/m);
      if (titleMatch && permalinkMatch) {
        // permalink хранится как "/posts/slug/index.html" — для ссылки в тексте нужен просто "/posts/slug/"
        const url = permalinkMatch[1].replace(/index\.html$/, "");
        posts.push({ title: titleMatch[1], url });
      }
    } catch {
      // если файл не читается — просто пропускаем, не критично
    }
  }
  return posts;
}

/**
 * Сохраняет на диск индекс всех статей сайта (title+url) — просто для удобства/отладки,
 * сам список для промпта DeepSeek собирается на лету из getExistingPosts() при каждом запуске.
 */
function saveInternalLinksIndex(siteId, posts) {
  const siteDir = path.join(ROOT, "sites", siteId);
  fs.mkdirSync(siteDir, { recursive: true });
  const indexPath = path.join(siteDir, "internal-links-index.json");
  fs.writeFileSync(indexPath, JSON.stringify(posts, null, 2), "utf-8");
}

async function processSite(site) {
  console.log(`\n=== Сайт: ${site.id} (${site.domain}) ===`);

  ensureSiteScaffold(site.id);

  const postsPerRun = site.posts_per_run || 1;

  for (let i = 0; i < postsPerRun; i++) {
    try {
      console.log(`[${site.id}] Получаю реальные запросы людей (Google Autocomplete)...`);
      const suggestedKeywords = await getNicheKeywordIdeas(site.niche);
      if (suggestedKeywords.length > 0) {
        console.log(`[${site.id}] Подсказки: ${suggestedKeywords.join(", ")}`);
      } else {
        console.log(`[${site.id}] Подсказок не получено (это не критично, статья сгенерируется и без них).`);
      }

      const existingPosts = getExistingPosts(site.id);
      const existingTitles = existingPosts.map((p) => p.title);

      console.log(`[${site.id}] Генерирую статью через DeepSeek...`);

      const todayStr = new Date().toISOString().split("T")[0];
      const refLink = pickRefLink(site.link_category, site.id, todayStr) || FALLBACK_REF_LINK;
      console.log(`[${site.id}] Использую ссылку: ${refLink}`);

      // Берём до 5 случайных существующих статей сайта для внутренней перелинковки
      // (если статей мало — DeepSeek просто не будет вставлять внутренние ссылки, это нормально)
      const internalLinks = [...existingPosts]
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

      const article = await generateArticle({
        niche: site.niche,
        lang: site.lang || "en",
        refLink,
        tone: site.tone,
        targetAudience: site.target_audience,
        writingStyle: site.writing_style,
        suggestedKeywords,
        existingTitles,
        internalLinks,
      });

      console.log(`[${site.id}] Статья готова: "${article.title}"`);

      // Генерируем ДВЕ разные картинки — обложку и иллюстрацию в середине статьи.
      // image_prompt_cover и image_prompt_body должны быть разными промптами (так просили в запросе к DeepSeek),
      // поэтому даже с одним и тем же style-модификатором сайта итоговые картинки не дублируются.
      const images = { cover: null, body: null };

      try {
        console.log(`[${site.id}] Генерирую обложку: "${article.image_prompt_cover}"`);
        const coverBuffer = await generateImage(article.image_prompt_cover, site.image_style);
        console.log(`[${site.id}] Загружаю обложку на imgbb...`);
        images.cover = await uploadToImgbb(coverBuffer, `${site.id}-${article.slug}-cover`);
        console.log(`[${site.id}] Обложка загружена: ${images.cover}`);
      } catch (imgErr) {
        console.error(`[${site.id}] ⚠️ Не удалось сгенерировать/загрузить обложку: ${imgErr.message}`);
      }

      try {
        const bodyPrompt = article.image_prompt_body || article.image_prompt_cover;
        console.log(`[${site.id}] Генерирую вторую картинку: "${bodyPrompt}"`);
        const bodyBuffer = await generateImage(bodyPrompt, site.image_style);
        console.log(`[${site.id}] Загружаю вторую картинку на imgbb...`);
        images.body = await uploadToImgbb(bodyBuffer, `${site.id}-${article.slug}-body`);
        console.log(`[${site.id}] Вторая картинка загружена: ${images.body}`);
      } catch (imgErr) {
        console.error(`[${site.id}] ⚠️ Не удалось сгенерировать/загрузить вторую картинку: ${imgErr.message}`);
      }

      saveArticle(site, article, images);
      saveInternalLinksIndex(site.id, [...existingPosts, { title: article.title, url: `/posts/${article.slug ? slugify(article.slug) : slugify(article.title)}/` }]);
    } catch (err) {
      console.error(`[${site.id}] ❌ Ошибка генерации статьи: ${err.message}`);
    }
  }
}

function buildFaqMarkdown(faq) {
  if (!Array.isArray(faq) || faq.length === 0) return "";
  const items = faq
    .map((item) => `### ${item.question}\n\n${item.answer}`)
    .join("\n\n");
  return `\n\n## Часто задаваемые вопросы\n\n${items}\n`;
}

function yamlEscape(str) {
  return String(str || "")
    .replace(/\r?\n/g, " ")
    .replace(/"/g, '\\"');
}

function buildFaqYaml(faq) {
  if (!Array.isArray(faq) || faq.length === 0) return null;
  const lines = ["faq:"];
  for (const item of faq) {
    lines.push(`  - question: "${yamlEscape(item.question)}"`);
    lines.push(`    answer: "${yamlEscape(item.answer)}"`);
  }
  return lines.join("\n");
}

function insertImageInMiddle(bodyMarkdown, imageMarkdown) {
  if (!imageMarkdown) return bodyMarkdown;

  // Вставляем картинку перед серединным абзацем/секцией, чтобы она оказалась
  // примерно посередине статьи, а не сразу под первым же подзаголовком.
  const paragraphs = bodyMarkdown.split(/\n\n/);
  const insertAt = Math.floor(paragraphs.length / 2);

  paragraphs.splice(insertAt, 0, imageMarkdown.trim());
  return paragraphs.join("\n\n");
}

function saveArticle(site, article, images) {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0];
  const slug = article.slug ? slugify(article.slug) : slugify(article.title);
  const filename = `${dateStr}-${slug}.md`;

  const postsDir = path.join(ROOT, "sites", site.id, "posts");
  fs.mkdirSync(postsDir, { recursive: true });

  const imageAltCover = article.image_alt_cover || article.title;
  const imageAltBody = article.image_alt_body || article.title;
  const faqYaml = buildFaqYaml(article.faq);

  const frontMatter = [
    "---",
    `layout: post.njk`,
    `permalink: "/posts/${slug}/index.html"`,
    `title: "${yamlEscape(article.title)}"`,
    `date: ${dateStr}`,
    `excerpt: "${yamlEscape(article.excerpt)}"`,
    `meta_description: "${yamlEscape(article.meta_description || article.excerpt)}"`,
    `image_alt: "${yamlEscape(imageAltCover)}"`,
    `keywords: [${(article.keywords || []).map((k) => `"${yamlEscape(k)}"`).join(", ")}]`,
    images.cover ? `image: "${images.cover}"` : null,
    faqYaml,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const coverMarkdown = images.cover ? `![${imageAltCover}](${images.cover})\n\n` : "";
  const bodyImageMarkdown = images.body ? `![${imageAltBody}](${images.body})` : "";

  let body = article.body_markdown || "";
  // Вставляем вторую картинку в середину статьи (если она сгенерировалась).
  // Если обложка не сгенерировалась, но вторая картинка есть — тогда она уйдёт в начало,
  // это нормальный fallback на случай частичного сбоя генерации картинок.
  if (bodyImageMarkdown) {
    body = insertImageInMiddle(body, bodyImageMarkdown);
  }

  const faqMarkdown = buildFaqMarkdown(article.faq);
  const bannersHtml = pickBannersHtml(site.link_category, site.id, slug);

  const fullContent = frontMatter + coverMarkdown + body + bannersHtml + faqMarkdown;

  const filePath = path.join(postsDir, filename);
  fs.writeFileSync(filePath, fullContent, "utf-8");

  console.log(`[${site.id}] ✅ Сохранено: ${path.relative(ROOT, filePath)}`);
}

async function main() {
  const sites = loadSites();
  const activeSites = sites.filter((s) => s.active);

  console.log(`Найдено активных сайтов: ${activeSites.length}`);

  for (const site of activeSites) {
    await processSite(site);
  }

  console.log("\n=== Готово. Все сайты обработаны. ===");
}

main().catch((err) => {
  console.error("❌ Критическая ошибка скрипта:", err);
  process.exit(1);
});
