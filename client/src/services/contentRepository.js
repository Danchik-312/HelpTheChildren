const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const API_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;
const pageGroups = { organizationSections: 'ABOUT', helpMethods: 'GIVE_HELP', getHelpDirections: 'GET_HELP', generalPages: 'GENERAL' };
const endpointFor = {
  publications: '/public/publications', stories: '/public/stories', children: '/public/children',
  projects: '/public/projects', hero: '/public/hero-slides',
  organizationSections: '/public/pages?group=ABOUT', helpMethods: '/public/pages?group=GIVE_HELP',
  getHelpDirections: '/public/pages?group=GET_HELP', generalPages: '/public/pages?group=GENERAL',
};
const projectCategories = { PROJECT: 'Проекты', PROGRAM: 'Программы', INITIATIVE: 'Инициативы' };
const publicationKinds = { NEWS: 'Новости', ARTICLE: 'Статьи' };
const rootAppRoute = /^\/(?:who-we|what-we-do|give-help|get-help|children|publications|stories|information|partners)?\/?$/i;
const detailAppRoute = /^\/(?:who-we|give-help|get-help|children|publications|stories|projects|information)\/[a-z0-9][a-z0-9-]*\/?$/i;
const isSafeAppRoute = value => typeof value === 'string' && (rootAppRoute.test(value) || detailAppRoute.test(value));
const UUID_PATH = /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mediaBaseUrl = new URL((import.meta.env.VITE_MEDIA_BASE_URL || `${API_BASE_URL}/public/media`).replace(/\/$/, ''), API_ORIGIN);
const allowedVideoHosts = new Set((import.meta.env.VITE_ALLOWED_VIDEO_HOSTS || 'youtube.com,www.youtube.com,youtu.be,vimeo.com,player.vimeo.com').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));

function buildPath(path, params = {}) {
  const [pathname, existingQuery = ''] = path.split('?');
  const query = new URLSearchParams(existingQuery);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString();
  return `${pathname}${suffix ? `?${suffix}` : ''}`;
}

async function requestJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
  if (response.status === 404) return { data: null, meta: null };
  if (!response.ok) throw new Error('Не удалось загрузить опубликованные данные.');
  const payload = await response.json();
  return { data: Object.prototype.hasOwnProperty.call(payload || {}, 'data') ? payload.data : payload, meta: payload?.meta || payload?.data?.meta || null };
}

async function getJson(path) { return (await requestJson(path)).data; }

export function publicMediaUrl(value, kind = 'IMAGE') {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value, API_ORIGIN);
    if (url.username || url.password) return undefined;
    if (kind === 'EXTERNAL_VIDEO') {
      if (url.protocol !== 'https:' || !allowedVideoHosts.has(url.hostname.toLowerCase())) return undefined;
      return url.href;
    }
    const expectedPrefix = mediaBaseUrl.pathname.replace(/\/$/, '');
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== mediaBaseUrl.origin || !url.pathname.startsWith(`${expectedPrefix}/`) || url.pathname.slice(expectedPrefix.length).match(UUID_PATH)?.[0] !== url.pathname.slice(expectedPrefix.length) || url.search || url.hash) return undefined;
    return url.href;
  } catch { return undefined; }
}

export function publicImageUrlById(mediaId) {
  if (typeof mediaId !== 'string' || !UUID_PATH.test('/' + mediaId) || mediaId.length !== 36) return undefined;
  return publicMediaUrl(mediaBaseUrl.href + '/' + mediaId);
}

function mapContent(resource, item) {
  const description = item.excerpt || item.summary || item.description || item.approvedHealthSummary || '';
  const displayName = item.publicDisplayName || item.title;
  const categories = (item.categories || []).map(category => ({ id: category.id, slug: category.slug, name: category.name }));
  const kindLabel = publicationKinds[item.kind] || projectCategories[item.kind] || '';
  return {
    ...item,
    to: resource === 'generalPages' && item.slug === 'partners' ? '/partners' : item.to || item.href || (pageGroups[resource] ? `${resource === 'helpMethods' ? '/give-help' : resource === 'getHelpDirections' ? '/get-help' : resource === 'generalPages' ? '/information' : '/who-we'}/${item.slug}` : undefined),
    title: resource === 'children' ? displayName : item.title,
    name: displayName, description, disease: item.approvedHealthSummary || '', age: item.publicAgeLabel || '',
    kind: item.kind, kindLabel, categories, categoryNames: categories.map(category => category.name),
    category: kindLabel || ({ ABOUT: 'Организация', GIVE_HELP: 'Помочь', GET_HELP: 'Получить помощь', GENERAL: 'Информация' }[item.group] || item.group || ''),
    date: item.publishedAt, body: item.body || item.storyBody || null,
    instructions: pageGroups[resource] ? item.body || null : null,
    image: publicMediaUrl(item.coverMedia?.url, item.coverMedia?.kind), imageAlt: item.coverMedia?.alt || '',
    ...(resource === 'publications' && {
      sidePhotos: Array.isArray(item.sidePhotos) ? item.sidePhotos.flatMap(photo => {
        const url = publicMediaUrl(photo?.url);
        if (!url || typeof photo.mediaId !== 'string') return [];
        return [{ mediaId: photo.mediaId, url, altText: photo.altText || '', caption: photo.caption || '' }];
      }) : [],
    }),
  };
}

function mapHero(slide) {
  const media = slide.media ? { ...slide.media, url: publicMediaUrl(slide.media.url, slide.media.kind) } : null;
  const poster = slide.poster ? { ...slide.poster, url: publicMediaUrl(slide.poster.url, slide.poster.kind) } : null;
  return {
    id: slide.id, slug: slide.id, title: slide.title || null, description: slide.subtitle || '', image: media?.url,
    media, poster, altText: slide.isDecorative ? '' : (slide.altText || media?.alt || ''), isDecorative: Boolean(slide.isDecorative),
    ctaLabel: slide.ctaLabel, to: isSafeAppRoute(slide.ctaUrl) ? slide.ctaUrl : undefined,
  };
}

async function listPage(collection, params = {}) {
  const endpoint = endpointFor[collection];
  if (!endpoint) throw new Error(`Unknown content collection: ${collection}`);
  const result = await requestJson(buildPath(endpoint, params));
  const rawItems = collection === 'hero' ? result.data?.items || [] : result.data?.items || result.data || [];
  const items = Array.isArray(rawItems) ? rawItems.map(item => collection === 'hero' ? mapHero(item) : mapContent(collection, item)) : [];
  return { items, meta: result.meta || { page: 1, pageSize: items.length, total: items.length, totalPages: items.length ? 1 : 0 } };
}

export const contentRepository = {
  async list(collection, params) { return (await listPage(collection, params)).items; },
  async listPage(collection, params) { return listPage(collection, params); },
  async categories(kind) { const data = await getJson(buildPath('/public/categories', { kind })); return data?.items || []; },
  async site() { return getJson('/public/site'); },
  async homepage() { const data = await getJson('/public/homepage'); return data?.items || []; },
  async navigation() { const data = await getJson('/public/navigation'); return (data?.items || []).filter(item => isSafeAppRoute(item.url)).map(item => ({ title: item.label, to: item.url })); },
  async findBySlug(collection, slug) {
    if (collection === 'hero') return (await this.list(collection)).find(item => item.slug === slug) ?? null;
    const endpoint = endpointFor[collection];
    if (!endpoint) throw new Error(`Unknown content collection: ${collection}`);
    const apiResource = pageGroups[collection] ? `pages/${pageGroups[collection]}` : collection;
    const data = await getJson(`/public/${apiResource}/${encodeURIComponent(slug)}`);
    return data ? mapContent(collection, data) : null;
  },
  async search(query) {
    const normalized = query.trim();
    if (!normalized) return this.navigation();
    const data = await getJson(`/public/search?q=${encodeURIComponent(normalized)}`);
    return (data?.items || []).filter(item => isSafeAppRoute(item.url)).map(item => ({ title: item.title, description: item.description || '', to: item.url }));
  },
};
