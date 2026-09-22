import { useEffect } from 'react'

const DEFAULT_TITLE = 'Resuming — Get back to your habits without the guilt'
const DEFAULT_DESCRIPTION =
  'Track what you postpone. Resume what matters. A calm, no-shame activity tracker.'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

export interface DocumentMetaOptions {
  title: string
  description?: string
  path?: string
  noindex?: boolean
}

/**
 * Set document title, description, robots, and canonical for the current screen.
 * Defaults restore on unmount so navigations don't leak meta.
 */
export function useDocumentMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  noindex = false,
}: DocumentMetaOptions) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    if (path != null) {
      const url = `https://resuming.me${path === '/' ? '/' : path}`
      upsertMeta('property', 'og:url', url)
      upsertLink('canonical', url)
    }

    return () => {
      document.title = prevTitle
    }
  }, [title, description, path, noindex])
}

export { DEFAULT_TITLE, DEFAULT_DESCRIPTION }
