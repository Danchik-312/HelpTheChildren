const SAFE_LINK_PROTOCOLS = new Set(['https:', 'mailto:']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeLinkHref(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const href = value.trim();
  if (href.includes('\\') || [...href].some(char => char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f)) return null;
  if (href.startsWith('/')) return href.startsWith('//') ? null : href;
  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'https:') return parsed.hostname && !parsed.username && !parsed.password ? parsed.toString() : null;
    return parsed.protocol === 'mailto:' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href.slice('mailto:'.length)) ? href : null;
  } catch (_error) {
    return null;
  }
}

export function safeImageAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object' || Object.keys(attrs).some(key => !['mediaId', 'alt', 'title'].includes(key))) return null;
  const mediaId = typeof attrs.mediaId === 'string' ? attrs.mediaId : '';
  if (!UUID.test(mediaId)) return null;
  return {
    mediaId,
    alt: typeof attrs.alt === 'string' ? attrs.alt.slice(0, 500) : '',
    title: typeof attrs.title === 'string' ? attrs.title.slice(0, 500) : null,
  };
}
