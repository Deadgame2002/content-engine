// scripts/llm.js
// Генерация текста через Cloudflare Worker (Llama 3).
// Переменные окружения: CF_AI_WORKER_URL, CF_AI_WORKER_KEY

/**
 * Отправляет запрос к Cloudflare Worker и возвращает строку ответа.
 * @param {string} prompt - запрос пользователя
 * @param {string} system - системный промпт
 * @param {number} maxTokens - максимум токенов (по умолчанию 3000)
 */
export async function generateText(prompt, system, maxTokens = 3000) {
  const workerUrl = process.env.CF_AI_WORKER_URL;
  const apiKey = process.env.CF_AI_WORKER_KEY;

  if (!workerUrl) throw new Error("Не задан CF_AI_WORKER_URL");
  if (!apiKey) throw new Error("Не задан CF_AI_WORKER_KEY");

  const response = await fetch(`${workerUrl}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system: system || "You are a helpful assistant.",
      prompt,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudflare Worker ошибка: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const text = data.text || "";
  if (!text) throw new Error("Worker вернул пустой ответ");

  return text;
}
