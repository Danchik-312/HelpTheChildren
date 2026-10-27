import { publicMediaUrl } from '../../lib/public-media-url.js';

const media = value => value && value.status === 'READY' && value.visibility === 'PUBLIC' ? {
  id: value.id, kind: value.kind, url: publicMediaUrl(value), alt: value.defaultAlt || '',
} : null;

export function publicContent(resource, item) {
  const common = { id: item.id, slug: item.slug, title: item.title, publishedAt: item.publishedAt, coverMedia: media(item.coverMedia) };
  if (resource === 'publications') return { ...common, kind: item.kind, excerpt: item.excerpt, body: item.body, categories: (item.categories || []).map(link => ({ id: link.category.id, slug: link.category.slug, name: link.category.name })) };
  if (resource === 'stories') return { ...common, excerpt: item.excerpt, body: item.body };
  if (resource === 'children') return {
    id: item.id, slug: item.slug, title: item.title, publicDisplayName: item.publicDisplayName,
    summary: item.summary, storyBody: item.storyBody, publicAgeLabel: item.publicAgeLabel,
    approvedHealthSummary: item.approvedHealthSummary, supportReason: item.supportReason,
    publishedAt: item.publishedAt, coverMedia: media(item.coverMedia),
  };
  if (resource === 'projects') return { ...common, kind: item.kind, projectState: item.projectState, summary: item.summary, body: item.body, startsAt: item.startsAt, endsAt: item.endsAt };
  return { ...common, group: item.group, description: item.description, body: item.body };
}
