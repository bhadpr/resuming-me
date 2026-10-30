import type { APIRoute } from 'astro'
import { CONTENT_UPDATED, SITE_URL } from '../site'
import { THEMES } from '../themes'

/** Every page that should be indexed. The 404 page is left out on purpose. */
const PATHS = ['/', '/about/', ...THEMES.map((theme) => `/${theme.slug}/`)]

export const GET: APIRoute = () => {
  const urls = PATHS.map(
    (path) => `  <url>
    <loc>${new URL(path, SITE_URL).href}</loc>
    <lastmod>${CONTENT_UPDATED}</lastmod>
  </url>`,
  ).join('\n')
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
