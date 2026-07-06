// scripts/imagegen.js
// Генерация картинки через твой Cloudflare Worker (FLUX-1-schnell).
// Worker URL и ключ берутся из переменных окружения CF_AI_WORKER_URL и CF_AI_WORKER_KEY.

export async function generateImage(prompt, styleModifier) {
  const workerUrl = process.env.CF_AI_WORKER_URL;
  const apiKey = process.env.CF_AI_WORKER_KEY;

  if (!workerUrl) throw new Error("Не задан CF_AI_WORKER_URL");
  if (!apiKey) throw new Error("Не задан CF_AI_WORKER_KEY");

  const finalPrompt = styleModifier ? `${prompt}, ${styleModifier}` : prompt;

  const response = await fetch(`${workerUrl}/image`, {
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
