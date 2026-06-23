// scripts/init-site.js
// Копирует шаблон 11ty (site-template/) в sites/<id>/, не трогая существующие posts/.
// Запуск: node scripts/init-site.js site1

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const siteId = process.argv[2];
if (!siteId) {
  console.error("Использование: node scripts/init-site.js <id-сайта>");
  process.exit(1);
}

const templateDir = path.join(ROOT, "site-template");
const targetDir = path.join(ROOT, "sites", siteId);

function copyRecursive(src, dest, skipDirs = []) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skipDirs.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath, skipDirs);
    } else {
      if (fs.existsSync(destPath)) {
        console.log(`Пропущено (уже существует): ${path.relative(ROOT, destPath)}`);
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
      console.log(`Скопировано: ${path.relative(ROOT, destPath)}`);
    }
  }
}

// Копируем всё, кроме папки posts (она специфична для каждого сайта и не должна затираться)
copyRecursive(templateDir, targetDir, ["posts", "node_modules", "_site"]);

// Папка posts создаётся пустой, если её ещё нет
const postsDir = path.join(targetDir, "posts");
if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
  console.log(`Создана папка: ${path.relative(ROOT, postsDir)}`);
}

console.log(`\n✅ Сайт "${siteId}" инициализирован в sites/${siteId}/`);
console.log(`Теперь подключи эту папку как Root directory в Cloudflare Pages.`);
