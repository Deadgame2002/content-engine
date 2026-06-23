module.exports = function (eleventyConfig) {
  // Статика (картинки, css) — если будут локальные файлы
  eleventyConfig.addPassthroughCopy("assets");

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
