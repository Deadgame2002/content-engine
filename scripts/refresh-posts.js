// scripts/refresh-posts.js
// Раз в неделю/месяц проходит по самым старым статьям каждого активного сайта
// и переписывает их через DeepSeek (refreshArticle) — делает текст подробнее, актуальнее,
// сохраняя заголовок и URL статьи (чтобы не терять накопленный SEO-вес страницы).
//
// Запуск: node scripts/refresh-posts.js
// Переменная REFRESH_POSTS_PER_SITE (по умолчанию 1) — сколько самых старых статей обновлять за раз на сайт.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { refreshArticle } from "./deepseek.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const POSTS_PER_SITE = parseInt(process.env.REFRESH_POSTS_PER_SITE || "1", 10);

function loadSites() {
  const configPath = path.join(ROOT, "config", "sites.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  try {
    const data = yaml.load(match[1]) || {};
    return { data, body: match[2] };
  } catch (e) {
    console.log(`  ⚠️ Ошибка парсинга YAML: ${e.message}`);
    return null;
  }
}

function getOldestPosts(siteId, count) {
  const postsDir = path.join(ROOT, "sites", siteId, "posts");
  if (!fs.existsSync(postsDir)) return [];

  const files = fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ file: f, fullPath: path.join(postsDir, f) }))
    .sort((a, b) => a.file.localeCompare(b.file)); // имена файлов начинаются с даты YYYY-MM-DD, сортировка по имени = по дате

  return files.slice(0, count);
}

function buildFaqMarkdown(faq) {
  if (!Array.isArray(faq) || faq.length === 0) return "";
  const items = faq.map((item) => `### ${item.question}\n\n${item.answer}`).join("\n\n");
  return `\n\n## Часто задаваемые вопросы\n\n${items}\n`;
}

async function refreshOnePost(site, postPath) {
  const content = fs.readFileSync(postPath, "utf-8");
  const parsed = parseFrontMatter(content);
  if (!parsed) {
    console.log(`  ⚠️ Не удалось распарсить front matter: ${postPath}`);
    return;
  }

  const title = parsed.data.title;
  if (!title) {
    console.log(`  ⚠️ Не найден title в: ${postPath}`);
    return;
  }

  // Убираем старый блок FAQ и блок баннеров из текста перед отправкой в DeepSeek
  // (FAQ будет пересоздан отдельно, баннеры — это HTML, не относящийся к самому тексту статьи)
  let oldBodyForRewrite = parsed.body.split(/\n## Часто задаваемые вопросы/)[0];
  oldBodyForRewrite = oldBodyForRewrite.replace(/<div class="cf-banners-block">[\s\S]*?<\/div>\n?/, "");

  console.log(`  Обновляю: "${title}"`);

  const refreshed = await refreshArticle({
    title,
    oldBodyMarkdown: oldBodyForRewrite,
    niche: site.niche,
    lang: site.lang || "en",
    tone: site.tone,
    writingStyle: site.writing_style,
  });

  // Обновляем только нужные поля, остальное (permalink, image, layout и т.д.) остаётся как было
  const updatedData = {
    ...parsed.data,
    excerpt: refreshed.excerpt || parsed.data.excerpt,
    meta_description: refreshed.meta_description || parsed.data.meta_description,
  };

  if (Array.isArray(refreshed.faq) && refreshed.faq.length > 0) {
    updatedData.faq = refreshed.faq.map((item) => ({
      question: item.question || "",
      answer: item.answer || "",
    }));
  }

  const frontMatterYaml = yaml.dump(updatedData, { lineWidth: -1 });

  // Сохраняем любой existing банерный HTML-блок, если он был в старом теле (вставляем перед новым FAQ)
  const bannerMatch = parsed.body.match(/<div class="cf-banners-block">[\s\S]*?<\/div>\n?/);
  const bannersHtml = bannerMatch ? `\n\n${bannerMatch[0]}` : "";

  const faqMarkdown = buildFaqMarkdown(refreshed.faq);

  const newContent = `---\n${frontMatterYaml}---\n\n${refreshed.body_markdown}${bannersHtml}${faqMarkdown}`;

  fs.writeFileSync(postPath, newContent, "utf-8");
  console.log(`  ✅ Обновлено: ${path.relative(ROOT, postPath)}`);
}

async function main() {
  const sites = loadSites().filter((s) => s.active);
  console.log(`Обновление старых статей. Сайтов: ${sites.length}, постов на сайт: ${POSTS_PER_SITE}`);

  for (const site of sites) {
    console.log(`\n=== ${site.id} ===`);
    const oldest = getOldestPosts(site.id, POSTS_PER_SITE);

    if (oldest.length === 0) {
      console.log("  Нет статей для обновления.");
      continue;
    }

    for (const { fullPath } of oldest) {
      try {
        await refreshOnePost(site, fullPath);
      } catch (err) {
        console.error(`  ❌ Ошибка обновления ${fullPath}: ${err.message}`);
      }
    }
  }

  console.log("\n=== Готово. ===");
}

main().catch((err) => {
  console.error("❌ Критическая ошибка скрипта обновления:", err);
  process.exit(1);
});
