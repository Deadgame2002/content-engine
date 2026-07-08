// scripts/audit.js
// Ежедневный бот-аудитор запускается каждый вечер и проверяет все активные сайты:
// - Есть ли статьи без картинок
// - Нет ли дублей slug/permalink
// - Нет ли постов с пустым body
// - Нет ли постов без FAQ
// - Нет ли постов без meta_description
// - Корректен ли YAML front matter (парсируется без ошибок)
// Результат пишется в sites/<id>/audit-report.json и в консоль.
// Если найдены критические проблемы — скрипт выходит с кодом 1 (GitHub Actions пометит запуск как failed).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadSites() {
  const raw = fs.readFileSync(path.join(ROOT, "config", "sites.json"), "utf-8");
  return JSON.parse(raw);
}

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    return yaml.load(match[1]);
  } catch {
    return null;
  }
}

function getBodyText(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : "";
}

function auditSite(site) {
  const postsDir = path.join(ROOT, "sites", site.id, "posts");
  const issues = [];
  const warnings = [];
  const stats = { total: 0, ok: 0, missing_image: 0, missing_faq: 0, missing_meta: 0, bad_yaml: 0, empty_body: 0 };

  if (!fs.existsSync(postsDir)) {
    warnings.push("Папка posts не найдена — сайт ещё не инициализирован");
    return { issues, warnings, stats };
  }

  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md")).sort();
  const seenPermalinks = new Set();

  for (const file of files) {
    stats.total++;
    const filePath = path.join(postsDir, file);
    let content;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      issues.push(`❌ Не удалось прочитать файл: ${file}`);
      continue;
    }

    const data = parseFrontMatter(content);
    if (!data) {
      issues.push(`❌ Невалидный YAML front matter: ${file}`);
      stats.bad_yaml++;
      continue;
    }

    // Проверка дублей permalink
    if (data.permalink) {
      if (seenPermalinks.has(data.permalink)) {
        issues.push(`❌ Дублирующийся permalink "${data.permalink}" в файле: ${file}`);
      }
      seenPermalinks.add(data.permalink);
    }

    // Проверка наличия картинки
    if (!data.image) {
      warnings.push(`⚠️ Нет обложки (image): ${file}`);
      stats.missing_image++;
    }

    // Проверка наличия meta_description
    if (!data.meta_description || data.meta_description.length < 50) {
      warnings.push(`⚠️ Нет или слишком короткая meta_description: ${file}`);
      stats.missing_meta++;
    }

    // Проверка наличия FAQ
    if (!Array.isArray(data.faq) || data.faq.length === 0) {
      warnings.push(`⚠️ Нет FAQ: ${file}`);
      stats.missing_faq++;
    }

    // Проверка что тело статьи не пустое
    const body = getBodyText(content);
    if (body.length < 200) {
      issues.push(`❌ Слишком короткое или пустое тело статьи: ${file} (${body.length} символов)`);
      stats.empty_body++;
    } else {
      stats.ok++;
    }
  }

  return { issues, warnings, stats };
}

function main() {
  const sites = loadSites().filter((s) => s.active);
  const timestamp = new Date().toISOString();
  let totalIssues = 0;
  let totalWarnings = 0;

  console.log(`\n🔍 Аудит сайтов: ${timestamp}`);
  console.log(`Активных сайтов: ${sites.length}\n`);

  const fullReport = { timestamp, sites: {} };

  for (const site of sites) {
    console.log(`=== ${site.id} (${site.domain}) ===`);
    const { issues, warnings, stats } = auditSite(site);

    console.log(`  Статей всего: ${stats.total} | OK: ${stats.ok} | Без картинки: ${stats.missing_image} | Без FAQ: ${stats.missing_faq}`);

    if (issues.length === 0 && warnings.length === 0) {
      console.log("  ✅ Всё в порядке");
    }

    for (const issue of issues) {
      console.log(`  ${issue}`);
    }
    for (const warning of warnings) {
      console.log(`  ${warning}`);
    }

    totalIssues += issues.length;
    totalWarnings += warnings.length;

    fullReport.sites[site.id] = { stats, issues, warnings };

    // Сохраняем отчёт в папку сайта
    const reportPath = path.join(ROOT, "sites", site.id, "audit-report.json");
    try {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify({ timestamp, stats, issues, warnings }, null, 2), "utf-8");
    } catch {
      // не критично если не смогли записать
    }
  }

  console.log(`\n=== Итог ===`);
  console.log(`Критических проблем: ${totalIssues}`);
  console.log(`Предупреждений: ${totalWarnings}`);

  if (totalIssues > 0) {
    console.log("\n❌ Найдены критические проблемы! Проверь логи выше.");
    // Выходим с кодом 1 — GitHub Actions пометит запуск как failed, придёт email-уведомление
    process.exit(1);
  } else {
    console.log("\n✅ Критических проблем не найдено.");
  }
}

main();
