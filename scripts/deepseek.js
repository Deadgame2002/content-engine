// scripts/deepseek.js
// Генерация текста статьи через DeepSeek API (OpenAI-совместимый формат).

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/**
 * Просит DeepSeek сгенерировать статью в формате JSON.
 * Возвращает { title, slug, excerpt, body_markdown, image_prompt, keywords }
 */
export async function generateArticle({ niche, lang, refLink }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Не задан DEEPSEEK_API_KEY в переменных окружения");

  const systemPrompt = `Ты — опытный контент-маркетолог и SEO-копирайтер.
Пишешь статьи для нишевого блога про "${niche}".
Статья должна быть полезной, живой, не похожей на рекламу в лоб.
В конце статьи естественно упомяни Creative Fabrica как сервис с готовыми шрифтами/SVG/клипартом по теме,
и вставь призыв к действию со ссылкой: ${refLink}
Отвечай СТРОГО в формате JSON, без markdown-обёртки, без пояснений — только валидный JSON со следующими полями:
{
  "title": "заголовок статьи (на языке ${lang})",
  "slug": "url-slug-latinskimi-bukvami-i-tire",
  "excerpt": "краткое описание 1-2 предложения",
  "body_markdown": "полный текст статьи в формате Markdown, 600-900 слов, с подзаголовками ## и списками где уместно, БЕЗ заголовка h1 в начале (заголовок уже есть отдельно), ссылка на Creative Fabrica должна быть оформлена как markdown-ссылка [текст](${refLink})",
  "image_prompt": "короткий промпт НА АНГЛИЙСКОМ для генерации обложки статьи, описывающий визуально тему статьи, без слов 'text' и без брендов",
  "keywords": ["ключевое слово 1", "ключевое слово 2", "ключевое слово 3"]
}`;

  const userPrompt = `Придумай тему статьи в нише "${niche}" (выбери конкретный угол, не пиши общую обзорную статью)
и напиши полноценную статью по формату выше. Язык статьи: ${lang === "ru" ? "русский" : "английский"}.`;

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
      temperature: 0.8,
      max_tokens: 2000,
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
