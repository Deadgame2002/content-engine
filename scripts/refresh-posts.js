// scripts/refresh-posts.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { refreshArticle } from "./article.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PER_SITE = parseInt(process.env.REFRESH_POSTS_PER_SITE || "1", 10);

function loadSites() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config", "sites.json"), "utf-8"));
}

function parseFM(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  try { return { data: yaml.load(m[1]) || {}, body: m[2] }; } catch { return null; }
}

function faqMarkdown(faq) {
  if (!Array.isArray(faq) || faq.length === 0) return "";
  return `\n\n## Frequently Asked Questions\n\n` +
    faq.map((f) => `### ${f.question}\n\n${f.answer}`).join("\n\n") + "\n";
}

async function refreshPost(site, filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseFM(content);
  if (!parsed || !parsed.data.title) return console.log(`  ⚠️ Пропускаю (нет title): ${filePath}`);

  const oldBody = parsed.body
    .split(/\n## Frequently Asked Questions/)[0]
    .replace(/<div class="cf-banners-block">[\s\S]*?<\/div>\n?/, "");

  console.log(`  Обновляю: "${parsed.data.title}"`);
  const refreshed = await refreshArticle({
    title: parsed.data.title,
    oldBodyMarkdown: oldBody,
    niche: site.niche,
    lang: site.lang || "en",
    tone: site.tone,
    writingStyle: site.writing_style,
  });

  const updatedData = {
    ...parsed.data,
    excerpt: refreshed.excerpt || parsed.data.excerpt,
    meta_description: refreshed.meta_description || parsed.data.meta_description,
  };
  if (Array.isArray(refreshed.faq) && refreshed.faq.length > 0) {
    updatedData.faq = refreshed.faq.map((f) => ({ question: String(f.question || ""), answer: String(f.answer || "") }));
  }

  const bannerMatch = parsed.body.match(/<div class="cf-banners-block">[\s\S]*?<\/div>\n?/);
  const bannersHtml = bannerMatch ? `\n\n${bannerMatch[0]}` : "";

  fs.writeFileSync(filePath,
    `---\n${yaml.dump(updatedData, { lineWidth: -1 })}---\n\n${refreshed.body_markdown}${bannersHtml}${faqMarkdown(refreshed.faq)}`,
    "utf-8"
  );
  console.log(`  ✅ Обновлено`);
}

async function main() {
  const sites = loadSites().filter((s) => s.active);
  console.log(`Обновление старых статей. Сайтов: ${sites.length}`);
  for (const site of sites) {
    console.log(`\n=== ${site.id} ===`);
    const dir = path.join(ROOT, "sites", site.id, "posts");
    if (!fs.existsSync(dir)) { console.log("  Нет статей."); continue; }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().slice(0, PER_SITE);
    for (const f of files) {
      try { await refreshPost(site, path.join(dir, f)); }
      catch (e) { console.error(`  ❌ Ошибка: ${e.message}`); }
    }
  }
  console.log("\n=== Готово ===");
}

main().catch((e) => { console.error("❌:", e); process.exit(1); });
