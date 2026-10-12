import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://resuming.app',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'always' },
})
