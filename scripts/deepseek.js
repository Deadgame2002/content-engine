// scripts/deepseek.js
// Генерация текста статьи через DeepSeek API (OpenAI-совместимый формат).
// v3: статьи длиннее и информативнее, два разных промпта для картинок (обложка + изображение в тексте),
// поддержка writing_style (стиль письма) отдельно от tone, поддержка подсказок по ключевым словам.

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const ARTICLE_TYPES = [
  "top-N список (например 'Топ 7 шрифтов для...')",
  "пошаговая инструкция 'как сделать'",
  "сравнение двух подходов/инструментов (с таблицей)",
  "разбор частых ошибок и как их избежать",
  "подборка идей/вдохновения с конкретными примерами",
  "глубокий разбор темы с практическими примерами (deep-dive guide)",
];

const WRITING_STYLES = [
  "короткие, рубленые предложения, разговорный стиль, как будто рассказываешь другу",
  "более длинные, плавные предложения с богатой лексикой, экспертный тон",
  "структура вопрос-ответ внутри секций, прямое обращение к читателю 'ты/you'",
  "повествовательный стиль с личными наблюдениями ('я заметил, что...', 'в своём опыте...')",
];

/**
 * Просит DeepSeek сгенерировать статью в формате JSON.
 * Возвращает { title, slug, meta_description, excerpt, body_markdown, faq,
 *              image_prompt_cover, image_prompt_body, image_alt_cover, image_alt_body, keywords }
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
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Не задан DEEPSEEK_API_KEY в переменных окружения");

  const effectiveTone = tone || "дружелюбный, практичный, без излишнего пафоса";
  const effectiveAudience = targetAudience || "люди, увлекающиеся рукоделием и крафтом, разного уровня опыта";
  const effectiveStyle =
    writingStyle || WRITING_STYLES[Math.floor(Math.random() * WRITING_STYLES.length)];

  // Случайно выбираем тип статьи, чтобы сайты не штамповали один и тот же формат каждый раз
  const articleType = ARTICLE_TYPES[Math.floor(Math.random() * ARTICLE_TYPES.length)];

  const keywordHint =
    Array.isArray(suggestedKeywords) && suggestedKeywords.length > 0
      ? `\nПОПУЛЯРНЫЕ ЗАПРОСЫ ЛЮДЕЙ (из Google Autocomplete, реально ищут это сейчас) — постарайся естественно закрыть тему одного-двух из них в статье:\n${suggestedKeywords.map((k) => `- ${k}`).join("\n")}`
      : "";

  const avoidDuplicateHint =
    Array.isArray(existingTitles) && existingTitles.length > 0
      ? `\nНЕ ПОВТОРЯЙ темы уже опубликованных статей на этом сайте, выбери другой угол:\n${existingTitles.slice(-15).map((t) => `- ${t}`).join("\n")}`
      : "";

  const systemPrompt = `Ты — опытный контент-маркетолог и SEO-копирайтер с глубокой экспертизой в теме "${niche}".
Пишешь для нишевого блога с аудиторией: ${effectiveAudience}.
Тон статьи: ${effectiveTone}.
Стиль письма (важно соблюдать именно этот стиль, он отличает этот сайт от других): ${effectiveStyle}.
${keywordHint}
${avoidDuplicateHint}

ТРЕБОВАНИЯ К КАЧЕСТВУ (это важно для SEO, не пропускай):
- Тип статьи на этот раз: ${articleType}
- Объём: 1600-2400 слов — статья должна быть по-настоящему информативной и исчерпывающей, а не поверхностной. Не сокращай в ущерб полноте темы.
- СТРУКТУРА ЗАГОЛОВКОВ (важно для SEO и читаемости):
  - Минимум 6-8 секций с подзаголовками ## (H2), каждая раскрывает конкретный аспект темы, не общие слова
  - Хотя бы в 3-4 секциях добавь подзаголовки ### (H3) внутри — например конкретные примеры, шаги, под-варианты
  - Заголовки H2/H3 должны быть конкретными ("Как закрепить блестящий винил на ткани" а не "Дополнительные советы")
- Используй конкретику: названия инструментов, материалов, размеры, шаги, цифры — НЕ общие фразы типа "выберите подходящий вариант"
- Если тема предполагает сравнение — добавь Markdown-таблицу (это сильно помогает попадать в Google Featured Snippets)
- В середине статьи естественно отметь место для второй иллюстрации (просто продолжай текст нормально, картинку вставит скрипт отдельно)
- В конце статьи (перед FAQ) — естественный абзац с упоминанием Creative Fabrica как источника готовых шрифтов/SVG/клипарта по теме, с призывом к действию и markdown-ссылкой: [текст](${refLink})
- ОБЯЗАТЕЛЬНО добавь блок FAQ: 4-5 вопросов-ответов в конце статьи, отвечающих на реальные вопросы людей по теме
- Если уместно, упомяни (текстом, без выдуманных ссылок) одну смежную подтему, которую можно развить в будущей статье

Отвечай СТРОГО в формате JSON, без markdown-обёртки, без пояснений — только валидный JSON:
{
  "title": "заголовок статьи (на языке ${lang}), конкретный, с цифрой или явной выгодой если подходит по типу статьи",
  "slug": "url-slug-latinskimi-bukvami-i-tire",
  "meta_description": "SEO meta description строго 120-155 символов, с ключевым словом в начале, на языке ${lang}",
  "excerpt": "краткое описание 1-2 предложения для карточки на главной странице",
  "body_markdown": "полный текст статьи в Markdown, БЕЗ h1 в начале (заголовок отдельно), с ## и ### подзаголовками, списками и таблицей где уместно, БЕЗ блока FAQ внутри (FAQ отдельным полем)",
  "faq": [
    {"question": "вопрос 1", "answer": "короткий чёткий ответ"},
    {"question": "вопрос 2", "answer": "короткий чёткий ответ"},
    {"question": "вопрос 3", "answer": "короткий чёткий ответ"},
    {"question": "вопрос 4", "answer": "короткий чёткий ответ"}
  ],
  "image_prompt_cover": "промпт НА АНГЛИЙСКОМ для ГЛАВНОЙ обложки статьи (общий вид темы статьи), без слов 'text' и без брендов",
  "image_prompt_body": "промпт НА АНГЛИЙСКОМ для ВТОРОЙ картинки в середине статьи — ДОЛЖЕН визуально отличаться от обложки: другой ракурс, другая деталь темы, другая композиция (например обложка — общий вид готового изделия, а вторая картинка — крупный план процесса или детали). Без слов 'text' и без брендов",
  "image_alt_cover": "короткое описательное alt-описание ОБЛОЖКИ НА ЯЗЫКЕ ${lang}, 5-10 слов",
  "image_alt_body": "короткое описательное alt-описание ВТОРОЙ КАРТИНКИ НА ЯЗЫКЕ ${lang}, 5-10 слов, не повторяющее alt обложки",
  "keywords": ["ключевое слово 1", "ключевое слово 2", "ключевое слово 3", "ключевое слово 4"]
}`;

  const userPrompt = `Придумай конкретную тему статьи в нише "${niche}" под тип "${articleType}" (выбери узкий, конкретный угол — не общий обзор)
и напиши полноценную статью строго по формату и требованиям выше. Язык статьи: ${lang === "ru" ? "русский" : "английский"}.
Не забудь: image_prompt_cover и image_prompt_body должны описывать ВИЗУАЛЬНО РАЗНЫЕ кадры, иначе на странице получится два одинаковых изображения.`;

  const response = await fetch(DEEPSEEK_API_URL, {
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
    const errText = await response.text();
    throw new Error(`DeepSeek API ошибка: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("DeepSeek не вернул содержимое ответа");

  // Подчищаем возможные markdown-обёртки ```json ... ```
  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Не удалось распарсить JSON от DeepSeek: ${e.message}\nОтвет был: ${cleaned}`);
  }

  return parsed;
}

/**
 * Просит DeepSeek переписать/обновить старую статью — оставляя тему,
 * но делая текст более актуальным, подробным и качественным.
 * Возвращает только { body_markdown, meta_description, excerpt, faq } — заголовок и slug не трогаем,
 * чтобы не сломать существующие ссылки на статью (URL остаётся прежним).
 */
export async function refreshArticle({ title, oldBodyMarkdown, niche, lang, tone, writingStyle }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Не задан DEEPSEEK_API_KEY в переменных окружения");

  const systemPrompt = `Ты — опытный SEO-редактор. Тебе дают старую статью блога в нише "${niche}".
Твоя задача — переписать и улучшить её: сделать более подробной, актуальной, добавить конкретики,
улучшить структуру заголовков (## и ###), не теряя исходную тему и заголовок.
Тон: ${tone || "дружелюбный, практичный"}. Стиль письма: ${writingStyle || "ясный, информативный"}.
Объём после переработки: 1600-2200 слов.
Отвечай СТРОГО в формате JSON, без пояснений:
{
  "body_markdown": "обновлённый полный текст статьи в Markdown, БЕЗ h1, БЕЗ FAQ-блока внутри",
  "meta_description": "обновлённая meta description 120-155 символов на языке ${lang}",
  "excerpt": "обновлённое краткое описание 1-2 предложения",
  "faq": [
    {"question": "вопрос 1", "answer": "ответ"},
    {"question": "вопрос 2", "answer": "ответ"},
    {"question": "вопрос 3", "answer": "ответ"}
  ]
}`;

  const userPrompt = `Заголовок статьи (не менять): "${title}"

Старый текст статьи для переработки:
"""
${oldBodyMarkdown.slice(0, 6000)}
"""

Перепиши и улучши эту статью по требованиям выше.`;

  const response = await fetch(DEEPSEEK_API_URL, {
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
    const errText = await response.text();
    throw new Error(`DeepSeek API ошибка (refresh): ${response.status} ${errText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("DeepSeek не вернул содержимое ответа (refresh)");

  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Не удалось распарсить JSON от DeepSeek (refresh): ${e.message}\nОтвет был: ${cleaned}`);
  }

  return parsed;
}
