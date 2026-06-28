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
  return { rawFrontMatter: match[1], body: match[2] };
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

function extractTitle(rawFrontMatter) {
  const match = rawFrontMatter.match(/^title:\s*"(.+)"$/m);
  return match ? match[1] : null;
}

function replaceField(rawFrontMatter, field, newValue) {
  const escaped = String(newValue || "").replace(/\r?\n/g, " ").replace(/"/g, '\\"');
  const regex = new RegExp(`^${field}:.*$`, "m");
  if (regex.test(rawFrontMatter)) {
    return rawFrontMatter.replace(regex, `${field}: "${escaped}"`);
  }
  return rawFrontMatter + `\n${field}: "${escaped}"`;
}

function buildFaqMarkdown(faq) {
  if (!Array.isArray(faq) || faq.length === 0) return "";
  const items = faq.map((item) => `### ${item.question}\n\n${item.answer}`).join("\n\n");
  return `\n\n## Часто задаваемые вопросы\n\n${items}\n`;
}

function buildFaqYaml(faq) {
  if (!Array.isArray(faq) || faq.length === 0) return null;
  const lines = ["faq:"];
  for (const item of faq) {
    const q = String(item.question || "").replace(/\r?\n/g, " ").replace(/"/g, '\\"');
    const a = String(item.answer || "").replace(/\r?\n/g, " ").replace(/"/g, '\\"');
    lines.push(`  - question: "${q}"`);
    lines.push(`    answer: "${a}"`);
  }
  return lines.join("\n");
}

async function refreshOnePost(site, postPath) {
  const content = fs.readFileSync(postPath, "utf-8");
  const parsed = parseFrontMatter(content);
  if (!parsed) {
    console.log(`  ⚠️ Не удалось распарсить front matter: ${postPath}`);
    return;
  }

  const title = extractTitle(parsed.rawFrontMatter);
  if (!title) {
    console.log(`  ⚠️ Не найден title в: ${postPath}`);
    return;
  }

  // Убираем старый блок FAQ из текста перед отправкой в DeepSeek (он будет пересоздан отдельно)
  const oldBodyWithoutFaq = parsed.body.split(/\n## Часто задаваемые вопросы/)[0];

  console.log(`  Обновляю: "${title}"`);

  const refreshed = await refreshArticle({
    title,
    oldBodyMarkdown: oldBodyWithoutFaq,
    niche: site.niche,
    lang: site.lang || "en",
    tone: site.tone,
    writingStyle: site.writing_style,
  });

  let newFrontMatter = parsed.rawFrontMatter;
  newFrontMatter = replaceField(newFrontMatter, "excerpt", refreshed.excerpt);
  newFrontMatter = replaceField(newFrontMatter, "meta_description", refreshed.meta_description);

  // Заменяем старый faq-блок (если был) на новый
  newFrontMatter = newFrontMatter.replace(/\nfaq:\n(?:\s{2}.*\n?)*/m, "");
  const faqYaml = buildFaqYaml(refreshed.faq);
  if (faqYaml) newFrontMatter += `\n${faqYaml}`;

  // Сохраняем картинки как были (cover остаётся в начале body — он не входил в oldBodyWithoutFaq
  // только если стоял перед текстом; в нашем случае cover вставляется ДО body в файле через frontMatter+coverMarkdown,
  // поэтому в самом body картинки могут быть — оставляем тело как пришло от DeepSeek, без картинок,
  // и просто переиспользуем оригинальный файл целиком: тело статьи без изменений картинок не трогаем).
  const faqMarkdown = buildFaqMarkdown(refreshed.faq);

  const newContent = `---\n${newFrontMatter}\n---\n${refreshed.body_markdown}${faqMarkdown}`;

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
