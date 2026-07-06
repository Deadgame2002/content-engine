/**
 * УНИВЕРСАЛЬНЫЙ AI WORKER — Cloudflare Workers AI
 * Поддерживает: генерация текста (Llama 3) + генерация картинок (FLUX)
 *
 * УСТАНОВКА (5 минут):
 * 1. dash.cloudflare.com → Workers & Pages → Create Worker
 * 2. Вставь весь этот код, нажми Deploy
 * 3. Settings → Variables → добавь API_KEY = любой секретный пароль
 * 4. Settings → Bindings → Add binding → тип AI → имя AI → сохрани
 *
 * ИСПОЛЬЗОВАНИЕ:
 *
 * ТЕКСТ:
 * POST https://твой-worker.workers.dev/text
 * Headers: Authorization: Bearer твой-ключ
 * Body: { "prompt": "напиши статью про...", "system": "ты эксперт по..." }
 * Ответ: { "text": "сгенерированный текст..." }
 *
 * КАРТИНКА:
 * POST https://твой-worker.workers.dev/image
 * Headers: Authorization: Bearer твой-ключ
 * Body: { "prompt": "красивый закат над горами" }
 * Ответ: бинарный файл PNG (сохраняй как .png)
 */

export default {
  async fetch(request, env) {

    // ── Проверка ключа ──────────────────────────────────────────────
    const auth = request.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (token !== env.API_KEY) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── ТЕКСТ: POST /text ───────────────────────────────────────────
    if (request.method === "POST" && path === "/text") {
      const body = await request.json();
      const prompt = body.prompt || "";
      const system = body.system || "You are a helpful assistant.";

      if (!prompt) {
        return new Response(JSON.stringify({ error: "prompt is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const result = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
      });

      return new Response(
        JSON.stringify({ text: result.response }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ── КАРТИНКА: POST /image ───────────────────────────────────────
    if (request.method === "POST" && path === "/image") {
      const body = await request.json();
      const prompt = body.prompt || "";

      if (!prompt) {
        return new Response(JSON.stringify({ error: "prompt is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const result = await env.AI.run(
        "@cf/black-forest-labs/flux-1-schnell",
        { prompt }
      );

      // Возвращаем PNG напрямую
      return new Response(result, {
        headers: { "Content-Type": "image/png" },
      });
    }

    // ── Неизвестный маршрут ─────────────────────────────────────────
    return new Response(
      JSON.stringify({
        status: "ok",
        routes: {
          "POST /text": "генерация текста (Llama 3)",
          "POST /image": "генерация картинки (FLUX)",
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};
