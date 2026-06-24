// scripts/imagegen.js
// Генерация картинки через твой Cloudflare Worker (free-image-generation-api).

/**
 * Возвращает Buffer с картинкой (JPEG).
 * styleModifier — необязательная строка-модификатор стиля/качества,
 * добавляется к промпту (например "high quality, soft lighting, photographic"
 * для блога, или "black and white line art coloring page, bold outlines, no shading"
 * для раскрасок).
 */
export async function generateImage(prompt, styleModifier) {
  const workerUrl = process.env.IMAGE_WORKER_URL;
  const apiKey = process.env.IMAGE_WORKER_API_KEY;

  if (!workerUrl) throw new Error("Не задан IMAGE_WORKER_URL в переменных окружения");
  if (!apiKey) throw new Error("Не задан IMAGE_WORKER_API_KEY в переменных окружения");

  const finalPrompt = styleModifier ? `${prompt}, ${styleModifier}` : prompt;

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: finalPrompt }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ошибка генерации картинки: ${response.status} ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
