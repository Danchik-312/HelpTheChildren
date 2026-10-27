import { env } from '../config/env.js';

export function publicMediaUrl(media, configuredBase = env.MEDIA_PUBLIC_BASE_URL) {
  if (!media) return null;
  if (media.kind === 'EXTERNAL_VIDEO') {
    const external = normalizeExternalVideoUrl(media.externalUrl);
    return external?.toString() || null;
  }
  const publicMediaBase = new URL(configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`);
  return new URL(encodeURIComponent(media.id), publicMediaBase).toString();
}

export function normalizeExternalVideoUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !env.allowedVideoHosts.includes(url.hostname.toLowerCase())) return null;
    const host = url.hostname.toLowerCase();
    if (['youtube.com', 'www.youtube.com'].includes(host)) {
      const id = url.pathname === '/watch'
        ? url.searchParams.get('v')
        : url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
      if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
      return new URL(`https://www.youtube.com/embed/${id}`);
    }
    if (host === 'youtu.be') {
      const id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
      return id ? new URL(`https://www.youtube.com/embed/${id}`) : null;
    }
    if (['vimeo.com', 'player.vimeo.com'].includes(host)) {
      const match = host === 'player.vimeo.com'
        ? url.pathname.match(/^\/video\/([0-9]{6,12})\/?$/)
        : url.pathname.match(/^\/([0-9]{6,12})\/?$/);
      return match ? new URL(`https://player.vimeo.com/video/${match[1]}`) : null;
    }
    return null;
  } catch {
    return null;
  }
}
