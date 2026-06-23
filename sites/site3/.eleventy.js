module.exports = function (eleventyConfig) {
  // Статика (картинки, css) — если будут локальные файлы
  eleventyConfig.addPassthroughCopy("assets");

  // Простой фильтр для даты в формате ISO (нужен для sitemap.xml)
  eleventyConfig.addFilter("isoDate", function (date) {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split("T")[0];
  });

  // Коллекция статей: всё из папки posts/*.md, сортировка от новых к старым
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("posts/*.md").sort((a, b) => b.date - a.date);
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
