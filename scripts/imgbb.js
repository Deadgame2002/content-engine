// scripts/imgbb.js
export async function uploadToImgbb(imageBuffer, name) {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error("Не задан IMGBB_API_KEY");

  const form = new URLSearchParams();
  form.append("key", apiKey);
  form.append("image", imageBuffer.toString("base64"));
  if (name) form.append("name", name);

  const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: form });
  if (!response.ok) throw new Error(`imgbb ошибка: ${response.status} ${await response.text()}`);

  const data = await response.json();
  if (!data.success) throw new Error(`imgbb: ${JSON.stringify(data)}`);
  return data.data.url;
}
