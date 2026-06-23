// scripts/imgbb.js
// Загрузка картинки на imgbb.com и получение прямой ссылки на неё.

/**
 * Принимает Buffer картинки, загружает на imgbb, возвращает прямую ссылку на изображение.
 */
export async function uploadToImgbb(imageBuffer, name) {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error("Не задан IMGBB_API_KEY в переменных окружения");

  const base64Image = imageBuffer.toString("base64");

  const form = new URLSearchParams();
  form.append("key", apiKey);
  form.append("image", base64Image);
  if (name) form.append("name", name);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ошибка загрузки на imgbb: ${response.status} ${errText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`imgbb вернул ошибку: ${JSON.stringify(data)}`);
  }

  // data.data.url — прямая ссылка на полноразмерное изображение
  return data.data.url;
}
