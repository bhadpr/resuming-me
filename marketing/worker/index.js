/** Sends www.resuming.app to resuming.app; everything else is the static site. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.hostname === 'www.resuming.app') {
      url.hostname = 'resuming.app'
      return Response.redirect(url.toString(), 301)
    }
    return env.ASSETS.fetch(request)
  },
}
