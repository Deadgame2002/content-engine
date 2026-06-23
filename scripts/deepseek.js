// scripts/deepseek.js
// Генерация текста статьи через DeepSeek API (OpenAI-совместимый формат).
// v2: добавлены тон/аудитория, FAQ-блок, требования к структуре и meta description для SEO.

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const ARTICLE_TYPES = [
  "top-N список (например 'Топ 7 шрифтов для...')",
  "пошаговая инструкция 'как сделать'",
  "сравнение двух подходов/инструментов (с таблицей)",
  "разбор частых ошибок и как их избежать",
  "подборка идей/вдохновения с конкретными примерами",
];

/**
 * Просит DeepSeek сгенерировать статью в формате JSON.
 * Возвращает { title, slug, meta_description, excerpt, body_markdown, faq, image_prompt, image_alt, keywords }
 */
export async function generateArticle({ niche, lang, refLink, tone, targetAudience }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Не задан DEEPSEEK_API_KEY в переменных окружения");

  const effectiveTone = tone || "дружелюбный, практичный, без излишнего пафоса";
  const effectiveAudience = targetAudience || "люди, увлекающиеся рукоделием и крафтом, разного уровня опыта";

  // Случайно выбираем тип статьи, чтобы сайты не штамповали один и тот же формат каждый раз
  const articleType = ARTICLE_TYPES[Math.floor(Math.random() * ARTICLE_TYPES.length)];

  const systemPrompt = `Ты — опытный контент-маркетолог и SEO-копирайтер с глубокой экспертизой в теме "${niche}".
Пишешь для нишевого блога с аудиторией: ${effectiveAudience}.
Тон статьи: ${effectiveTone}.

ТРЕБОВАНИЯ К КАЧЕСТВУ (это важно для SEO, не пропускай):
- Тип статьи на этот раз: ${articleType}
- Объём: 1100-1600 слов
- Минимум 4-5 подзаголовков (##), каждый раскрывает конкретный аспект темы, не общие слова
- Используй конкретику: названия инструментов, материалов, размеры, шаги — НЕ общие фразы типа "выберите подходящий вариант"
- Если тема предполагает сравнение — добавь Markdown-таблицу (это сильно помогает попадать в Google Featured Snippets)
- В конце статьи (перед FAQ) — естественный абзац с упоминанием Creative Fabrica как источника готовых шрифтов/SVG/клипарта по теме, с призывом к действию и markdown-ссылкой: [текст](${refLink})
- ОБЯЗАТЕЛЬНО добавь блок FAQ: 3-4 вопроса-ответа в конце статьи, отвечающих на реальные вопросы людей по теме (формат ниже)
- Если уместно, упомяни (текстом, без выдуманных ссылок) одну смежную подтему, которую можно развить в будущей статье

Отвечай СТРОГО в формате JSON, без markdown-обёртки, без пояснений — только валидный JSON:
{
  "title": "заголовок статьи (на языке ${lang}), конкретный, с цифрой или явной выгодой если подходит по типу статьи",
  "slug": "url-slug-latinskimi-bukvami-i-tire",
  "meta_description": "SEO meta description строго 120-155 символов, с ключевым словом в начале, на языке ${lang}",
  "excerpt": "краткое описание 1-2 предложения для карточки на главной странице",
  "body_markdown": "полный текст статьи в Markdown, БЕЗ h1 в начале (заголовок отдельно), с ## подзаголовками, списками и таблицей где уместно, БЕЗ блока FAQ внутри (FAQ отдельным полем)",
  "faq": [
    {"question": "вопрос 1", "answer": "короткий чёткий ответ"},
    {"question": "вопрос 2", "answer": "короткий чёткий ответ"},
    {"question": "вопрос 3", "answer": "короткий чёткий ответ"}
  ],
  "image_prompt": "короткий промпт НА АНГЛИЙСКОМ для генерации обложки статьи, описывающий визуально тему статьи, без слов 'text' и без брендов",
  "image_alt": "короткое описательное alt-описание картинки НА ЯЗЫКЕ ${lang}, 5-10 слов, не дублирующее заголовок статьи целиком",
  "keywords": ["ключевое слово 1", "ключевое слово 2", "ключевое слово 3", "ключевое слово 4"]
}`;

  const userPrompt = `Придумай конкретную тему статьи в нише "${niche}" под тип "${articleType}" (выбери узкий, конкретный угол — не общий обзор)
и напиши полноценную статью строго по формату и требованиям выше. Язык статьи: ${lang === "ru" ? "русский" : "английский"}.`;

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
      max_tokens: 3000,
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
