---
name: testing-sites
description: Test the content-engine 11ty sites (redesign + SEO) end-to-end. Use when verifying template/design/SEO changes to site-template or sites/site1|2|3, or when validating generated-post quality.
---

# Testing the content-engine sites

This repo is an 11ty (Eleventy) static-site generator. Master templates live in `site-template/`
and are mirrored to `sites/site1` (fonts), `sites/site2` (wedding), `sites/site3` (craft).
Each site deploys to Cloudflare Pages.

## How to test (no credentials needed)
The sites are public. Prefer testing the **live branch preview** deployments over building locally —
Cloudflare Pages builds a per-branch preview automatically. Preview URL pattern:
`https://<branch-slug>.<project>.pages.dev/` where projects are `site1-fonts`, `weddingworld`, `mycraftblog`.
Find the exact URLs from the PR's Cloudflare Pages status checks / bot comments (use `git_view_pr`).

If you need to test locally instead:
```
cd sites/site1 && SITE_NAME="Cricut Fonts Hub" SITE_BASE_URL="https://example.com" npx @11ty/eleventy --serve
```
(env vars vary per site; check `site.json`/`_data`).

## What to verify (primary flows)
1. **Homepage** — hero (eyebrow + serif `<h1>` + description), a big featured "Latest" post card,
   and a "More articles" hover-lift card grid.
2. **Dark mode** — the 🌙/☀️ button in the header toggles `data-theme` and persists via
   `localStorage` across reload. Click it (native click, not devtools) and reload to confirm persistence.
3. **Post page** — breadcrumb, byline (date · reading time · author), cover image, serif headings,
   styled comparison table, `#keyword` tag chips, gradient CTA button, and a "Keep reading"
   related-posts grid (3 cards).
4. **SEO structured data** — verify via shell, not the DOM (JSON-LD is in `<script>` tags):
   ```
   curl -s "<post-url>" | grep -o '"@type": *"[^"]*"' | sort -u
   curl -s "<post-url>" | grep -o '<meta property="og:type"[^>]*>'
   ```
   Expect `BlogPosting`, `BreadcrumbList`, `FAQPage`, `Organization`, `WebSite`, and `og:type=article` on posts.
5. **All 3 sites** — confirm the redesign renders on all three with their own branding.

## Gotchas / future-proofing
- **Old posts contain pre-generated text.** Some committed markdown predates prompt changes and may show
  quirks (e.g. a Russian FAQ heading "Часто задаваемые вопросы"). This is a data issue in the post file,
  NOT a template bug — don't flag it as a redesign regression. New posts generated via `scripts/article.js`
  use the updated English prompt.
- Generator/content changes only affect **newly generated** articles; verifying them requires running the
  generation pipeline (needs DeepSeek/DeepInfra/imgbb keys) or inspecting a freshly generated post.
- The page DOM returned with screenshots marks off-viewport nodes `offscreen=""`; scroll to bring an element
  into view before asserting it's visually present.

## Devin Secrets Needed
- None for testing the deployed/preview sites (public).
- Only if regenerating content: `DEEPSEEK_API_KEY`, `DEEPINFRA_API_KEY`, `IMGBB_API_KEY` (names per `scripts/`/`config/`).
