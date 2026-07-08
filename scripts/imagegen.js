// scripts/imagegen.js
// Генерация картинок через DeepInfra API, модель FLUX-1-schnell.
// ВАЖНО: промпты должны быть короткими (5-12 слов) и явно запрещать любой текст/буквы на картинке.

const DEEPINFRA_URL = "https://api.deepinfra.com/v1/openai/images/generations";

// Базовый суффикс который добавляется к КАЖДОМУ промпту — запрещает текст на картинке
// и задаёт профессиональный фотографический стиль
const BASE_SUFFIX = "no text, no words, no letters, no watermarks, professional photography, clean composition";

/**
 * Генерирует картинку и возвращает Buffer.
 * @param {string} prompt - короткое описание сцены (5-12 слов, без упоминания текста/букв)
 * @param {string} styleModifier - дополнительный стиль из конфига сайта (необязательно)
 */
export async function generateImage(prompt, styleModifier) {
  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) throw new Error("Не задан DEEPINFRA_API_KEY");

  // Очищаем промпт от упоминаний текста/букв — частая причина артефактов
  const cleanPrompt = prompt
    .replace(/\btext\b/gi, "")
    .replace(/\blabel\b/gi, "")
    .replace(/\bword[s]?\b/gi, "")
    .replace(/\bletter[s]?\b/gi, "")
    .replace(/\bwriting\b/gi, "")
    .replace(/\bfont[s]?\b/gi, "typeface sample")
    .trim()
    .replace(/\s+/g, " ");

  const parts = [cleanPrompt];
  if (styleModifier) parts.push(styleModifier);
  parts.push(BASE_SUFFIX);

  const finalPrompt = parts.join(", ");

  const response = await fetch(DEEPINFRA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX-1-schnell",
      prompt: finalPrompt,
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepInfra ошибка: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("DeepInfra не вернул b64_json");

  return Buffer.from(b64, "base64");
}
