import { useEffect } from 'react'

const DEFAULT_TITLE = 'Resuming: Habits & Reminders'
const DEFAULT_DESCRIPTION =
  'Everything in one gentle list: habits, reminders, meetups, health, holidays and games. Free, no ads.'

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
  /** Social title when it should be shorter than the browser title. */
  ogTitle?: string
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
  ogTitle,
  description = DEFAULT_DESCRIPTION,
  path,
  noindex = false,
}: DocumentMetaOptions) {
  useEffect(() => {
    const prevTitle = document.title
    const socialTitle = ogTitle ?? title
    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    upsertMeta('property', 'og:title', socialTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('name', 'twitter:title', socialTitle)
    upsertMeta('name', 'twitter:description', description)
    if (path != null) {
      const url = `https://resuming.me${path === '/' ? '/' : path}`
      upsertMeta('property', 'og:url', url)
      upsertLink('canonical', url)
    }

    return () => {
      document.title = prevTitle
    }
  }, [title, ogTitle, description, path, noindex])
}

export { DEFAULT_TITLE, DEFAULT_DESCRIPTION }
