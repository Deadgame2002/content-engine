// scripts/llama.js
// Пример вызова Llama 3 через твой Cloudflare Worker для генерации текста.
// Можно использовать вместо deepseek.js если хочешь сэкономить на API-ключах.
// Качество Llama 3 8B немного ниже DeepSeek для длинных статей,
// но для коротких задач (заголовки, описания, FAQ) — вполне достаточно.

export async function generateWithLlama(prompt, systemPrompt) {
  const workerUrl = process.env.CF_AI_WORKER_URL;
  const apiKey = process.env.CF_AI_WORKER_KEY;

  if (!workerUrl) throw new Error("Не задан CF_AI_WORKER_URL");
  if (!apiKey) throw new Error("Не задан CF_AI_WORKER_KEY");

  const response = await fetch(`${workerUrl}/text`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system: systemPrompt || "You are a helpful assistant.",
      prompt,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ошибка Llama Worker: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.text || "";
}
