// scripts/update-old-links.js
// Проходит по ВСЕМ уже опубликованным статьям всех активных сайтов и:
// 1. Если в статье ещё нет блока баннеров Creative Fabrica (cf-banners-block) — добавляет его перед FAQ/в конец
// 2. Баннеры/ссылки берутся из актуальных config/cf_links.json и config/cf_banners.json,
//    с добавлением UTM-меток — то есть старые статьи получают те же свежие баннеры, что и новые
//
// Запуск: node scripts/update-old-links.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pickBannersHtml } from "./banners.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadSites() {
  const configPath = path.join(ROOT, "config", "sites.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}

function getSlugFromFilename(filename) {
  // имя файла вида 2026-06-28-some-slug.md
  const match = filename.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/);
  return match ? match[1] : filename.replace(/\.md$/, "");
}

function updatePost(site, postPath, filename) {
  let content = fs.readFileSync(postPath, "utf-8");

  if (content.includes("cf-banners-block")) {
    console.log(`  ⏭️  Уже есть баннеры, пропускаю: ${filename}`);
    return false;
  }

  const slug = getSlugFromFilename(filename);
  const bannersHtml = pickBannersHtml(site.link_category, site.id, slug);

  if (!bannersHtml) {
    console.log(`  ⚠️ Нет подходящих баннеров для категории "${site.link_category}", пропускаю: ${filename}`);
    return false;
  }

  // Если в статье есть блок FAQ — вставляем баннеры ПЕРЕД ним, иначе просто в конец файла
  // Поддерживаем и новый английский заголовок, и старый русский (для ранее сгенерированных статей)
  const faqMarkers = ["\n## Frequently Asked Questions", "\n## Часто задаваемые вопросы"];
  const faqMarker = faqMarkers.find((m) => content.includes(m));
  if (faqMarker) {
    content = content.replace(faqMarker, `${bannersHtml}${faqMarker}`);
  } else {
    content = content + bannersHtml;
  }

  fs.writeFileSync(postPath, content, "utf-8");
  console.log(`  ✅ Баннеры добавлены: ${filename}`);
  return true;
}

function main() {
  const sites = loadSites().filter((s) => s.active);
  console.log(`Обновление баннеров в старых статьях. Сайтов: ${sites.length}`);

  let totalUpdated = 0;

  for (const site of sites) {
    console.log(`\n=== ${site.id} ===`);
    const postsDir = path.join(ROOT, "sites", site.id, "posts");

    if (!fs.existsSync(postsDir)) {
      console.log("  Папка с постами не найдена, пропускаю.");
      continue;
    }

    const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));
    if (files.length === 0) {
      console.log("  Нет статей.");
      continue;
    }

    for (const file of files) {
      const updated = updatePost(site, path.join(postsDir, file), file);
      if (updated) totalUpdated++;
    }
  }

  console.log(`\n=== Готово. Обновлено статей: ${totalUpdated} ===`);
}

main();
