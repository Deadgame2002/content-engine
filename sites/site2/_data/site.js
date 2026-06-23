module.exports = {
  site_name: process.env.SITE_NAME || "My Craft Blog",
  site_description: process.env.SITE_DESCRIPTION || "Fonts, SVGs and craft ideas",
  ref_link: "https://www.creativefabrica.com/ref/8793785/",
  // Укажи реальный домен сайта в переменной окружения SITE_BASE_URL в настройках Cloudflare Pages,
  // например https://fonts-for-cricut.pages.dev или https://твой-домен.com (без слэша на конце)
  base_url: process.env.SITE_BASE_URL || "",
  currentYear: new Date().getFullYear(),
};
