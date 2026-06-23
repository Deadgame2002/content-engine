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

async function processSite(site) {
  console.log(`\n=== Сайт: ${site.id} (${site.domain}) ===`);

  ensureSiteScaffold(site.id);

  const postsPerRun = site.posts_per_run || 1;

  for (let i = 0; i < postsPerRun; i++) {
    try {
      console.log(`[${site.id}] Генерирую статью через DeepSeek...`);

      const refLink = pickRefLink(site.link_category) || FALLBACK_REF_LINK;
      console.log(`[${site.id}] Использую ссылку: ${refLink}`);

      const article = await generateArticle({
        niche: site.niche,
        lang: site.lang || "en",
        refLink,
        tone: site.tone,
        targetAudience: site.target_audience,
      });

      console.log(`[${site.id}] Статья готова: "${article.title}"`);

      let imageUrl = null;
      try {
        console.log(`[${site.id}] Генерирую обложку: "${article.image_prompt}"`);
        const imageBuffer = await generateImage(article.image_prompt);

        console.log(`[${site.id}] Загружаю обложку на imgbb...`);
        imageUrl = await uploadToImgbb(imageBuffer, `${site.id}-${article.slug}`);
        console.log(`[${site.id}] Картинка загружена: ${imageUrl}`);
      } catch (imgErr) {
        console.error(`[${site.id}] ⚠️ Не удалось сгенерировать/загрузить картинку: ${imgErr.message}`);
        console.error(`[${site.id}] Статья будет сохранена без картинки.`);
      }

      saveArticle(site, article, imageUrl);
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

function saveArticle(site, article, imageUrl) {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0];
  const slug = article.slug ? slugify(article.slug) : slugify(article.title);
  const filename = `${dateStr}-${slug}.md`;

  const postsDir = path.join(ROOT, "sites", site.id, "posts");
  fs.mkdirSync(postsDir, { recursive: true });

  const imageAlt = article.image_alt || article.title;
  const faqYaml = buildFaqYaml(article.faq);

  const frontMatter = [
    "---",
    `layout: post.njk`,
    `permalink: "/posts/${slug}/index.html"`,
    `title: "${yamlEscape(article.title)}"`,
    `date: ${dateStr}`,
    `excerpt: "${yamlEscape(article.excerpt)}"`,
    `meta_description: "${yamlEscape(article.meta_description || article.excerpt)}"`,
    `image_alt: "${yamlEscape(imageAlt)}"`,
    `keywords: [${(article.keywords || []).map((k) => `"${yamlEscape(k)}"`).join(", ")}]`,
    imageUrl ? `image: "${imageUrl}"` : null,
    faqYaml,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const imageMarkdown = imageUrl ? `![${imageAlt}](${imageUrl})\n\n` : "";
  const faqMarkdown = buildFaqMarkdown(article.faq);

  const fullContent = frontMatter + imageMarkdown + (article.body_markdown || "") + faqMarkdown;

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
