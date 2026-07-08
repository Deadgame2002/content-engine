// scripts/article.js
// Генерация SEO-статьи через DeepSeek API.
// Улучшения v4: внутренние + внешние ссылки, запрет текста в промптах картинок,
// более длинные и информативные статьи, разные стили письма на каждом сайте.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const ARTICLE_TYPES = [
  "top-N list (e.g. 'Top 7 fonts for...')",
  "step-by-step how-to guide",
  "comparison with a markdown table (A vs B)",
  "common mistakes and how to fix them",
  "inspiration roundup with concrete examples",
  "deep-dive guide with practical tips",
];

// Авторитетные внешние ресурсы по нишам — Google ценит ссылки на качественные сайты
const EXTERNAL_SOURCES = {
  fonts: [
    { name: "Google Fonts", url: "https://fonts.google.com" },
    { name: "Font Squirrel", url: "https://www.fontsquirrel.com" },
  ],
  wedding: [
    { name: "The Knot", url: "https://www.theknot.com" },
    { name: "Brides", url: "https://www.brides.com" },
  ],
  scrapbooking: [
    { name: "Scrapbook.com", url: "https://www.scrapbook.com" },
  ],
  clipart: [
    { name: "Pinterest", url: "https://www.pinterest.com" },
  ],
  default: [
    { name: "Pinterest", url: "https://www.pinterest.com" },
    { name: "Cricut Help Center", url: "https://help.cricut.com" },
  ],
};

function pickExternal(linkCategory) {
  const sources = EXTERNAL_SOURCES[linkCategory] || EXTERNAL_SOURCES.default;
  return sources.slice(0, 2);
}

/**
 * Генерирует статью через DeepSeek.
 * Возвращает объект с полями: title, slug, meta_description, excerpt,
 * body_markdown, faq, image_prompt_cover, image_prompt_body,
 * image_alt_cover, image_alt_body, keywords
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
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Не задан DEEPSEEK_API_KEY");

  const articleType = ARTICLE_TYPES[Math.floor(Math.random() * ARTICLE_TYPES.length)];
  const externalSources = pickExternal(linkCategory || "default");

  const keywordHint =
    Array.isArray(suggestedKeywords) && suggestedKeywords.length > 0
      ? `\nPEOPLE ACTUALLY SEARCH FOR (use naturally in article):\n${suggestedKeywords.map((k) => `- ${k}`).join("\n")}`
      : "";

  const avoidHint =
    Array.isArray(existingTitles) && existingTitles.length > 0
      ? `\nALREADY PUBLISHED — pick a DIFFERENT topic/angle:\n${existingTitles.slice(-15).map((t) => `- ${t}`).join("\n")}`
      : "";

  const internalHint =
    Array.isArray(internalLinks) && internalLinks.length > 0
      ? `\nINTERNAL LINKS — if 1-2 are topically related, link naturally in text as [title](url). If none fit — skip completely, do NOT force:\n${internalLinks.map((p) => `- "${p.title}" → ${p.url}`).join("\n")}`
      : "";

  const externalHint = `\nEXTERNAL LINKS — mention and link 1-2 of these authoritative sites where it fits naturally (improves SEO trust):\n${externalSources.map((s) => `- [${s.name}](${s.url})`).join("\n")}`;

  const systemPrompt = `You are an expert SEO content writer specializing in "${niche}".
Writing for: ${targetAudience || "craft enthusiasts of all skill levels"}.
Tone: ${tone || "friendly, practical, like an experienced crafter friend"}.
Writing style: ${writingStyle || "clear, conversational, specific — not generic advice"}.

REQUIREMENTS — follow ALL of these:
- Article type: ${articleType}
- Length: 1600-2200 words — thorough and genuinely useful, not padded
- Structure: minimum 6 H2 sections (##). At least 3 of them must have H3 subsections (###) inside. Headings must be SPECIFIC ("How to Fix Vinyl Bleeding on Dark Shirts" not "More Tips")
- Use real specifics: tool names, temperatures, measurements, step numbers — NOT vague phrases like "choose the right option"
- Include a markdown comparison TABLE where it makes sense
- Near the end, naturally mention Creative Fabrica with a markdown link: [descriptive text](${refLink})
- End with 4-5 FAQ questions people actually ask about this topic
${keywordHint}
${avoidHint}
${internalHint}
${externalHint}

IMAGE PROMPTS RULES (critical — follow exactly):
- image_prompt_cover and image_prompt_body: 6-10 words each, describe a VISUAL SCENE only
- NO words like "text", "font name", "label", "letter", "writing", "word" in image prompts
- The two prompts must describe VISUALLY DIFFERENT scenes (different angle, different detail, different composition)
- Good examples: "crafter weeding vinyl on light box", "colorful heat transfer vinyl sheets flat lay"
- Bad examples: "font letters for cricut", "text design tutorial image"

RESPOND ONLY with valid raw JSON — no markdown fences, no explanation, no preamble:
{
  "title": "specific title with number or clear benefit",
  "slug": "url-slug-latin-hyphens-only",
  "meta_description": "120-155 chars, keyword first",
  "excerpt": "1-2 sentence summary for homepage card",
  "body_markdown": "full article, NO h1 at top, NO faq section here, with ## and ### headings, lists, table",
  "faq": [
    {"question": "real question", "answer": "concise answer"},
    {"question": "real question", "answer": "concise answer"},
    {"question": "real question", "answer": "concise answer"},
    {"question": "real question", "answer": "concise answer"}
  ],
  "image_prompt_cover": "6-10 word visual scene, no text/fonts/letters/words mentioned",
  "image_prompt_body": "6-10 word DIFFERENT visual scene, no text/fonts/letters/words mentioned",
  "image_alt_cover": "short descriptive alt text for cover image",
  "image_alt_body": "short descriptive alt text for body image, different from cover",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
}`;

  const userPrompt = `Write a ${articleType} article for the niche: "${niche}".
Choose a specific narrow angle — not a generic overview. Language: English.`;

  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 4500,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API ошибка: ${response.status} ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("DeepSeek вернул пустой ответ");

  return parseDeepSeekJson(raw);
}

/**
 * Надёжный парсер JSON из ответа DeepSeek.
 * Справляется с: markdown-обёртками, текстом до/после JSON,
 * и невалидными управляющими символами (главная причина ошибки "Bad control character").
 */
function parseDeepSeekJson(raw) {
  // 1. Убираем markdown-обёртки ```json ... ```
  let cleaned = raw.replace(/```json|```/g, "").trim();

  // 2. Вырезаем только JSON-объект (на случай если DeepSeek добавил текст до/после)
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`JSON-объект не найден в ответе: ${cleaned.slice(0, 200)}`);
  cleaned = jsonMatch[0];

  // 3. Пробуем парсить как есть
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 4. Исправляем невалидные управляющие символы внутри JSON-строк.
  // "Bad control character" возникает когда DeepSeek вставляет буквальный \n или \t
  // внутри JSON-строки вместо экранированных \\n и \\t.
  // Заменяем их только внутри строковых значений (между кавычками).
  const fixed = cleaned.replace(
    /"((?:[^"\\]|\\[\s\S])*)"/g,
    (match) => {
      return match
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
    }
  );

  try {
    return JSON.parse(fixed);
  } catch (e) {
    throw new Error(`Не удалось распарсить JSON от DeepSeek: ${e.message}\nФрагмент: ${cleaned.slice(0, 300)}`);
  }
}

/**
 * Переписывает старую статью — делает её подробнее и актуальнее.
 * Сохраняет title и URL (SEO-вес страницы не теряется).
 */
export async function refreshArticle({ title, oldBodyMarkdown, niche, tone, writingStyle }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Не задан DEEPSEEK_API_KEY");

  const systemPrompt = `You are an expert SEO editor. Improve this blog article from the niche "${niche}".
Make it more detailed, specific, and useful. Improve heading structure (## and ###). Keep the same title and topic.
Tone: ${tone || "friendly, practical"}. Style: ${writingStyle || "clear and informative"}.
Target length: 1600-2000 words.
RESPOND ONLY with valid raw JSON, no markdown fences:
{
  "body_markdown": "improved full article, NO h1, NO faq section",
  "meta_description": "updated 120-155 char meta description",
  "excerpt": "updated 1-2 sentence summary",
  "faq": [
    {"question": "q", "answer": "a"},
    {"question": "q", "answer": "a"},
    {"question": "q", "answer": "a"}
  ]
}`;

  const userPrompt = `Title (keep exactly): "${title}"\n\nOld article:\n"""\n${oldBodyMarkdown.slice(0, 5000)}\n"""`;

  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek refresh ошибка: ${response.status} ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("DeepSeek вернул пустой ответ (refresh)");

  return parseDeepSeekJson(raw);
}
