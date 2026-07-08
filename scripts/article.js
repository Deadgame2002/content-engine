// scripts/article.js
// Генерация статьи через Llama (Cloudflare Worker).
// Улучшения SEO: внутренние ссылки, внешние ссылки на авторитетные ресурсы, структура H2/H3.

import { generateText } from "./llm.js";

const ARTICLE_TYPES = [
  "top-N list (e.g. 'Top 7 fonts for...')",
  "step-by-step how-to guide",
  "comparison with a table (A vs B)",
  "common mistakes and how to fix them",
  "inspiration roundup with concrete examples",
  "deep-dive guide with practical tips",
];

// Авторитетные внешние ресурсы по нише — Google ценит ссылки на качественные источники
const EXTERNAL_SOURCES = {
  fonts: [
    { name: "Google Fonts", url: "https://fonts.google.com" },
    { name: "Font Squirrel", url: "https://www.fontsquirrel.com" },
  ],
  svg: [
    { name: "W3C SVG specification", url: "https://www.w3.org/TR/SVG2/" },
    { name: "MDN SVG documentation", url: "https://developer.mozilla.org/en-US/docs/Web/SVG" },
  ],
  cricut: [
    { name: "Cricut official help center", url: "https://help.cricut.com" },
  ],
  wedding: [
    { name: "The Knot", url: "https://www.theknot.com" },
  ],
  scrapbooking: [
    { name: "Scrapbook.com", url: "https://www.scrapbook.com" },
  ],
  default: [
    { name: "Pinterest", url: "https://www.pinterest.com" },
  ],
};

function pickExternalSources(linkCategory) {
  const sources = EXTERNAL_SOURCES[linkCategory] || EXTERNAL_SOURCES.default;
  return sources.slice(0, 2);
}

/**
 * Генерирует статью. Возвращает объект:
 * { title, slug, meta_description, excerpt, body_markdown, faq,
 *   image_prompt_cover, image_prompt_body, image_alt_cover, image_alt_body, keywords }
 */
export async function generateArticle({
  niche,
  lang,
  refLink,
  tone,
  targetAudience,
  writingStyle,
  suggestedKeywords,
  existingTitles,
  internalLinks,
  linkCategory,
}) {
  const articleType = ARTICLE_TYPES[Math.floor(Math.random() * ARTICLE_TYPES.length)];
  const externalSources = pickExternalSources(linkCategory || "default");

  const keywordHint =
    Array.isArray(suggestedKeywords) && suggestedKeywords.length > 0
      ? `\nPEOPLE ACTUALLY SEARCH FOR (Google Autocomplete) — naturally address 1-2 of these:\n${suggestedKeywords.map((k) => `- ${k}`).join("\n")}`
      : "";

  const avoidHint =
    Array.isArray(existingTitles) && existingTitles.length > 0
      ? `\nALREADY PUBLISHED — pick a DIFFERENT angle:\n${existingTitles.slice(-12).map((t) => `- ${t}`).join("\n")}`
      : "";

  const internalLinksHint =
    Array.isArray(internalLinks) && internalLinks.length > 0
      ? `\nINTERNAL LINKS — if 1-2 are topically related, link to them naturally in the text using exact markdown [title](url). If none fit — skip, do NOT force it:\n${internalLinks.map((p) => `- "${p.title}" → ${p.url}`).join("\n")}`
      : "";

  const externalLinksHint = `\nEXTERNAL LINKS — naturally mention and link to 1-2 of these authoritative sources where relevant (improves SEO credibility):\n${externalSources.map((s) => `- [${s.name}](${s.url})`).join("\n")}`;

  const system = `You are an expert SEO content writer specializing in "${niche}".
Writing for: ${targetAudience || "craft enthusiasts of all skill levels"}.
Tone: ${tone || "friendly, practical, knowledgeable"}.
Writing style: ${writingStyle || "clear sentences, conversational but informative"}.

QUALITY REQUIREMENTS — follow all of these:
- Article type: ${articleType}
- Length: 1600-2200 words — thorough and genuinely useful, not padded
- HEADINGS: minimum 6 H2 sections (##), with H3 subsections (###) inside at least 3 of them. Headings must be specific ("How to Fix Vinyl Bleeding on Dark Shirts" not "Tips")
- Use real specifics: tool names, exact measurements, temperatures, step numbers — NOT vague advice
- Include a comparison TABLE where it makes sense (great for Google Featured Snippets)
- AFFILIATE: near the end, naturally mention Creative Fabrica as a resource with markdown link: [text](${refLink})
- FAQ: 4-5 questions people actually ask about this topic
${keywordHint}
${avoidHint}
${internalLinksHint}
${externalLinksHint}

RESPOND ONLY with valid JSON, no markdown fences, no explanation:
{
  "title": "specific title with number or benefit if fits the article type",
  "slug": "url-slug-with-hyphens-only-latin",
  "meta_description": "SEO meta description 120-155 chars, keyword first",
  "excerpt": "1-2 sentence summary for card on homepage",
  "body_markdown": "full article markdown, NO h1, NO faq section (separate field), with ## and ### headings, lists, and table",
  "faq": [
    {"question": "real question", "answer": "concise clear answer"},
    {"question": "real question", "answer": "concise clear answer"},
    {"question": "real question", "answer": "concise clear answer"},
    {"question": "real question", "answer": "concise clear answer"}
  ],
  "image_prompt_cover": "SHORT 6-10 word visual scene for cover image, NO text/letters/words mentioned",
  "image_prompt_body": "SHORT 6-10 word visual scene VISUALLY DIFFERENT from cover, different angle or detail, NO text/letters/words",
  "image_alt_cover": "short descriptive alt text for cover image",
  "image_alt_body": "short descriptive alt text for body image, different from cover",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4"]
}`;

  const userPrompt = `Write a ${articleType} article for the niche: "${niche}".
Choose a specific, narrow angle — not a generic overview.
Language: English.
Remember: image_prompt_cover and image_prompt_body must describe VISUALLY DIFFERENT scenes, short, NO text or letters.`;

  const raw = await generateText(userPrompt, system, 3500);

  // Чистим возможные markdown-обёртки
  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Llama иногда добавляет лишний текст до/после JSON — пробуем вырезать
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Не удалось распарсить JSON от Llama. Ответ: ${cleaned.slice(0, 300)}`);
    try {
      parsed = JSON.parse(match[0]);
    } catch (e2) {
      throw new Error(`Невалидный JSON от Llama: ${e2.message}`);
    }
  }

  return parsed;
}

/**
 * Переписывает старую статью — делает её более подробной и актуальной.
 */
export async function refreshArticle({ title, oldBodyMarkdown, niche, lang, tone, writingStyle }) {
  const system = `You are an expert SEO editor. Rewrite and improve this blog article from the niche "${niche}".
Make it more detailed, specific, and useful. Improve heading structure (## and ###).
Keep the same title and topic, just make it better.
Tone: ${tone || "friendly, practical"}. Style: ${writingStyle || "clear and informative"}.
Target length: 1600-2000 words.
RESPOND ONLY with valid JSON, no markdown fences:
{
  "body_markdown": "improved full article, NO h1, NO faq",
  "meta_description": "updated 120-155 char meta description",
  "excerpt": "updated 1-2 sentence summary",
  "faq": [
    {"question": "q", "answer": "a"},
    {"question": "q", "answer": "a"},
    {"question": "q", "answer": "a"}
  ]
}`;

  const userPrompt = `Title (keep it): "${title}"\n\nOld article to improve:\n"""\n${oldBodyMarkdown.slice(0, 5000)}\n"""`;

  const raw = await generateText(userPrompt, system, 3500);
  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Невалидный JSON от Llama (refresh). Ответ: ${cleaned.slice(0, 300)}`);
    parsed = JSON.parse(match[0]);
  }

  return parsed;
}
