// scripts/utm.js
export function addUtm(url, siteId, postSlug) {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=${encodeURIComponent(siteId || "site")}&utm_medium=blog&utm_campaign=${encodeURIComponent(postSlug || "post")}`;
}
