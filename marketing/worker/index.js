/**
 * Sends www.resuming.app to resuming.app; everything else is the static site.
 *
 * Visitors in the EU, the UK, Switzerland, Norway, Iceland and Liechtenstein get
 * <html data-consent="required">, so the page asks before it counts their visit
 * (see src/measure.ts). When the country is unknown the page asks too.
 */
const ALSO_ASKS = new Set(['GB', 'CH', 'NO', 'IS', 'LI'])

export function needsConsent(cf) {
  const country = cf?.country
  if (!country || country === 'XX' || country === 'T1') return true
  return cf.isEUCountry === '1' || ALSO_ASKS.has(country)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.hostname === 'www.resuming.app') {
      url.hostname = 'resuming.app'
      return Response.redirect(url.toString(), 301)
    }
    const response = await env.ASSETS.fetch(request)
    const isPage = (response.headers.get('content-type') ?? '').includes('text/html')
    if (!isPage || !needsConsent(request.cf)) return response
    return new HTMLRewriter()
      .on('html', {
        element(element) {
          element.setAttribute('data-consent', 'required')
        },
      })
      .transform(response)
  },
}
