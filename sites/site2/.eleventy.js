module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("_headers");

  eleventyConfig.addFilter("isoDate", function (date) {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split("T")[0];
  });

  eleventyConfig.addFilter("readableDate", function (date) {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  });

  eleventyConfig.addFilter("readingTime", function (htmlOrText) {
    const text = String(htmlOrText || "").replace(/<[^>]*>/g, " ");
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  });

  // Newest other posts, excluding the current one.
  eleventyConfig.addFilter("relatedPosts", function (posts, currentUrl, limit) {
    return (posts || [])
      .filter((p) => p.url !== currentUrl)
      .slice(0, limit || 3);
  });

  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("posts/*.md").sort((a, b) => b.date - a.date);
  });

  return {
    dir: { input: ".", includes: "_includes", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
