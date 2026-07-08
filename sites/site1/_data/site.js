module.exports = {
  site_name: process.env.SITE_NAME || "My Craft Blog",
  site_description: process.env.SITE_DESCRIPTION || "Fonts, SVGs and craft ideas",
  contact_email: process.env.SITE_CONTACT_EMAIL || "",
  ref_link: "https://www.creativefabrica.com/ref/8793785/",
  base_url: process.env.SITE_BASE_URL || "",
  currentYear: new Date().getFullYear(),
};
