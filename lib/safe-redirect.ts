const INTERNAL_ORIGIN = 'https://internal.raisesea.invalid'

/** Return a same-origin path or the fallback. Rejects URL parser edge cases. */
export function safeInternalRedirect(path: string | null | undefined, fallback = '/dashboard'): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback
  if (path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return fallback

  try {
    const parsed = new URL(path, INTERNAL_ORIGIN)
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
