// scripts/fix-missing-images.js
// Находит все статьи без обложки (нет поля image: в front matter)
// и генерирует для них картинку через DeepInfra + загружает на imgbb.
// Запускается каждый день в 21:00 UTC — после вечернего аудита.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { generateImage } from "./imagegen.js";
import { uploadToImgbb } from "./imgbb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Максимум картинок за один запуск — чтобы не превысить лимиты DeepInfra/imgbb
const MAX_PER_RUN = parseInt(process.env.FIX_IMAGES_MAX || "10", 10);

function loadSites() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config", "sites.json"), "utf-8"));
}

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try { return yaml.load(match[1]); } catch { return null; }
}

function updateImageInFile(filePath, imageUrl, imageAlt) {
  let content = fs.readFileSync(filePath, "utf-8");

  // Добавляем image: и image_alt: в front matter если их нет
  content = content.replace(/^---\n([\s\S]*?)\n---/, (match, fm) => {
    let fmData;
    try { fmData = yaml.load(fm) || {}; } catch { return match; }

    if (!fmData.image) fmData.image = imageUrl;
    if (!fmData.image_alt) fmData.image_alt = imageAlt;

    return `---\n${yaml.dump(fmData, { lineWidth: -1 })}---`;
  });

  // Добавляем картинку в начало тела статьи (после front matter)
  const parts = content.split(/^---\n[\s\S]*?\n---\n+/);
  if (parts.length >= 2) {
    const fmBlock = content.match(/^---\n[\s\S]*?\n---/)?.[0] || "";
    const body = parts[parts.length - 1];

    // Добавляем только если картинки ещё нет в начале текста
    if (!body.trimStart().startsWith("![")){
      const imageMarkdown = `![${imageAlt}](${imageUrl})\n\n`;
      content = `${fmBlock}\n\n${imageMarkdown}${body}`;
    }
  }

  fs.writeFileSync(filePath, content, "utf-8");
}

// Создаём промпт для картинки из заголовка статьи
function buildImagePrompt(title, niche, imageStyle) {
  // Убираем числа и общие слова из заголовка — оставляем суть
  const cleanTitle = title
    .replace(/^\d+\s+/g, "")
    .replace(/^(Top|Best|How to|A Guide to|The|Why|What|When)\s+/gi, "")
    .replace(/\b(for|with|and|the|a|an|of|in|on|at|to|vs|or)\b/gi, " ")
    .replace(/[^a-zA-Z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");

  // Базовый промпт из темы + стиль сайта (без упоминания текста/букв)
  const base = `${cleanTitle}, craft workspace, natural light`;
  const style = imageStyle || "professional photography, clean composition";
  return `${base}, ${style}, no text, no words, no letters`;
}

async function fixMissingImages() {
  const sites = loadSites().filter((s) => s.active);
  let totalFixed = 0;
  let totalSkipped = 0;

  console.log(`\n🔧 Исправление пропущенных картинок: ${new Date().toISOString()}`);
  console.log(`Максимум за запуск: ${MAX_PER_RUN}\n`);

  for (const site of sites) {
    if (totalFixed >= MAX_PER_RUN) {
      console.log(`\nДостигнут лимит ${MAX_PER_RUN} картинок за запуск. Остальные будут обработаны завтра.`);
      break;
    }

    console.log(`=== ${site.id} (${site.domain}) ===`);
    const postsDir = path.join(ROOT, "sites", site.id, "posts");
    if (!fs.existsSync(postsDir)) { console.log("  Нет статей."); continue; }

    const files = fs.readdirSync(postsDir)
      .filter((f) => f.endsWith(".md"))
      .sort(); // от старых к новым

    let siteFixed = 0;

    for (const file of files) {
      if (totalFixed >= MAX_PER_RUN) break;

      const filePath = path.join(postsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const data = parseFrontMatter(content);

      if (!data) {
        console.log(`  ⚠️ Пропускаю (нечитаемый front matter): ${file}`);
        continue;
      }

      // Пропускаем если картинка уже есть
      if (data.image) {
        totalSkipped++;
        continue;
      }

      const title = data.title || file;
      const imagePrompt = buildImagePrompt(title, site.niche, site.image_style);
      const imageAlt = data.image_alt || title.slice(0, 80);

      console.log(`  📸 Генерирую картинку для: "${title}"`);
      console.log(`     Промпт: "${imagePrompt}"`);

      try {
        const imageBuffer = await generateImage(imagePrompt, null);
        const slugName = file.replace(".md", "");
        const imgName = `${site.id}-${slugName}-cover`.slice(0, 100);
        const imageUrl = await uploadToImgbb(imageBuffer, imgName);

        updateImageInFile(filePath, imageUrl, imageAlt);

        console.log(`  ✅ Картинка добавлена: ${imageUrl}`);
        totalFixed++;
        siteFixed++;

        // Небольшая пауза между запросами чтобы не перегружать API
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error(`  ❌ Ошибка для "${title}": ${err.message}`);
      }
    }

    if (siteFixed === 0) console.log("  ✅ Все статьи уже имеют картинки.");
    else console.log(`  Исправлено на ${site.id}: ${siteFixed}`);
  }

  console.log(`\n=== Итог ===`);
  console.log(`Картинок добавлено: ${totalFixed}`);
  console.log(`Статей с картинками (пропущено): ${totalSkipped}`);

  if (totalFixed > 0) {
    console.log("\n✅ Готово — не забудь закоммитить изменения (GitHub Actions сделает это автоматически).");
  } else {
    console.log("\n✅ Всё чисто — у всех статей есть картинки.");
  }
}

fixMissingImages().catch((e) => {
  console.error("❌ Критическая ошибка:", e);
  process.exit(1);
});
