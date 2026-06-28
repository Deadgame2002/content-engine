// scripts/imagegen.js
// Генерация картинки через DeepInfra API, модель black-forest-labs/FLUX-1-schnell.
// Документация: https://deepinfra.com/black-forest-labs/FLUX-1-schnell/api

const DEEPINFRA_URL = "https://api.deepinfra.com/v1/openai/images/generations";

/**
 * Возвращает Buffer с картинкой (PNG/JPEG, решает сама модель).
 * styleModifier — необязательная строка-модификатор стиля/качества,
 * добавляется к промпту (например "high quality, soft lighting, photographic"
 * для блога, или "black and white line art coloring page, bold outlines, no shading"
 * для раскрасок).
 */
export async function generateImage(prompt, styleModifier) {
  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) throw new Error("Не задан DEEPINFRA_API_KEY в переменных окружения");

  const finalPrompt = styleModifier ? `${prompt}, ${styleModifier}` : prompt;

  const response = await fetch(DEEPINFRA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: finalPrompt,
      size: "1024x1024",
      model: "black-forest-labs/FLUX-1-schnell",
      n: 1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ошибка DeepInfra (генерация картинки): ${response.status} ${errText}`);
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("DeepInfra не вернул b64_json с картинкой");

  return Buffer.from(b64, "base64");
}
