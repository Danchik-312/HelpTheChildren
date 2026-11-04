import { structuredContentSchema } from '../../src/modules/content/structured-content.validation.js';

const allowedTargets = new Set(['OrganizationProfile', 'InfoPage', 'Publication', 'Project', 'Category', 'HomeBlock']);
const contentTargets = new Set(['OrganizationProfile', 'InfoPage', 'Publication', 'Project']);

export function parseRows(sql, table) {
  const pattern = new RegExp('INSERT INTO `' + table + '`\\s*\\((.*?)\\)\\s*VALUES\\s*', 'gs');
  const rows = [];
  let match;
  while ((match = pattern.exec(sql)) !== null) {
    const columns = match[1].split(',').map(value => value.trim().replaceAll('`', ''));
    let cursor = pattern.lastIndex;
    while (cursor < sql.length) {
      while (/\s/.test(sql[cursor])) cursor += 1;
      if (sql[cursor] === ';') break;
      if (sql[cursor] !== '(') throw new Error(`Expected tuple for ${table} at ${cursor}`);
      cursor += 1;
      const values = [];
      while (true) {
        while (/\s/.test(sql[cursor])) cursor += 1;
        let value;
        if (sql[cursor] === "'") {
          cursor += 1;
          const buffer = [];
          while (cursor < sql.length) {
            const char = sql[cursor];
            if (char === '\\') {
              const next = sql[cursor + 1];
              const escapes = { n: '\n', r: '\r', t: '\t', 0: '\0', b: '\b', Z: '\x1a' };
              buffer.push(escapes[next] ?? next);
              cursor += 2;
            } else if (char === "'") {
              if (sql[cursor + 1] === "'") { buffer.push("'"); cursor += 2; }
              else { cursor += 1; break; }
            } else { buffer.push(char); cursor += 1; }
          }
          value = buffer.join('');
        } else {
          const start = cursor;
          while (sql[cursor] !== ',' && sql[cursor] !== ')') cursor += 1;
          const raw = sql.slice(start, cursor).trim();
          value = raw === 'NULL' ? null : raw;
        }
        values.push(value);
        while (/\s/.test(sql[cursor])) cursor += 1;
        if (sql[cursor] === ',') { cursor += 1; continue; }
        if (sql[cursor] === ')') { cursor += 1; break; }
        throw new Error(`Invalid tuple for ${table} at ${cursor}`);
      }
      rows.push(Object.fromEntries(columns.map((column, index) => [column, values[index]])));
      while (/\s/.test(sql[cursor])) cursor += 1;
      if (sql[cursor] === ',') { cursor += 1; continue; }
      if (sql[cursor] === ';') break;
    }
    pattern.lastIndex = cursor + 1;
  }
  return rows;
}

const entityMap = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…',
};

export function decodeHtml(value) {
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return entityMap[entity.toLowerCase()] ?? match;
  });
}

export function htmlToText(value) {
  return decodeHtml(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote|tr|section|article)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\u0000/g, '')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function htmlToStructuredContent(value, fallback = '') {
  const text = htmlToText(value).slice(0, 200_000) || String(fallback || '').trim();
  const paragraphs = text.split(/\n{2,}|\n(?=• )/).map(item => item.trim()).filter(Boolean).slice(0, 4_999);
  const content = (paragraphs.length ? paragraphs : ['Материал требует редакционной проверки.']).flatMap(paragraph => {
    const chunks = paragraph.match(/[\s\S]{1,50000}/g) || [];
    return chunks.map(chunk => ({ type: 'paragraph', content: [{ type: 'text', text: chunk }] }));
  }).slice(0, 4_999);
  const document = { type: 'doc', content };
  const parsed = structuredContentSchema.safeParse(document);
  if (!parsed.success) throw new Error('Legacy HTML could not be converted to structured content.');
  return document;
}

const transliteration = new Map(Object.entries({
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}));

export function safeSlug(value, fallbackId) {
  const transliterated = [...String(value || '').trim().toLowerCase()].map(char => transliteration.get(char) ?? char).join('');
  const normalized = transliterated.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 150).replace(/-+$/g, '');
  return normalized || `legacy-${fallbackId}`;
}

function uniqueSlug(base, oldId, seen) {
  let slug = safeSlug(base, oldId);
  if (seen.has(slug)) slug = `${slug.slice(0, Math.max(1, 159 - String(oldId).length))}-${oldId}`;
  seen.add(slug);
  return slug;
}

function limit(value, max, fallback) {
  const text = htmlToText(value).trim();
  return (text || fallback).slice(0, max).trim();
}

function legacyDate(value) {
  if (!value || String(value).startsWith('0000-00-00')) return undefined;
  const parsed = new Date(String(value).replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function sourceTimestamps(row) {
  const createdAt = legacyDate(row.created);
  const updatedAt = legacyDate(row.modified) || createdAt;
  return { ...(createdAt && { createdAt }), ...(updatedAt && { updatedAt }) };
}

export function parseMigrationData(source) {
  return JSON.parse(String(source).replace(/^window\.MIGRATION_DATA\s*=\s*/, '').replace(/;\s*$/, ''));
}

export function buildImportPlan({ sql, migrationData }) {
  const contentRows = parseRows(sql, 'chdg4_content');
  const contentById = new Map(contentRows.map(row => [String(row.id), row]));
  const selected = migrationData.distributed.filter(item => allowedTargets.has(item.target)
    && item.confidence === 'HIGH'
    && (item.sourceStatusLabel === 'опубликовано' || item.sourceStatusLabel === 'сводная запись'));
  const missingSources = [];
  const seen = { publications: new Set(), projects: new Set(), pages: new Set(), categories: new Set() };
  const plan = { organization: null, categories: [], pages: [], publications: [], projects: [], homeBlocks: [], skipped: [], missingSources };

  for (const item of selected) {
    if (contentTargets.has(item.target) && !contentById.has(String(item.oldId))) {
      missingSources.push({ target: item.target, oldId: String(item.oldId) });
      continue;
    }
    if (item.target === 'Category') {
      plan.categories.push({ legacyId: String(item.oldId), slug: uniqueSlug(item.alias || item.title, item.oldId, seen.categories), name: limit(item.title, 120, `Категория ${item.oldId}`) });
      continue;
    }
    if (item.target === 'HomeBlock') {
      const key = String(item.uid).replace(/^home-/, '');
      plan.homeBlocks.push({ legacyId: String(item.oldId), key, enabled: true, position: plan.homeBlocks.length, heading: limit(item.title, 240, key), description: limit(item.snippet, 1000, '') || null });
      continue;
    }

    const row = contentById.get(String(item.oldId));
    const rawBody = `${row.introtext || ''}\n${row.fulltext || ''}`;
    const fallback = limit(item.previewText || item.snippet || item.title, 1000, item.title);
    const body = htmlToStructuredContent(rawBody, fallback);
    const title = limit(row.title || item.title, 240, `Материал ${item.oldId}`);
    const description = limit(row.metadesc || row.introtext || rawBody, 1000, title);
    const timestamps = sourceTimestamps(row);

    if (item.target === 'OrganizationProfile') {
      plan.organization = { legacyId: String(item.oldId), displayName: 'Help The Children SKD', shortDescription: description, description: body, ...timestamps };
    } else if (item.target === 'InfoPage') {
      const group = item.reason.match(/раздела (ABOUT|GIVE_HELP|GET_HELP|GENERAL)/)?.[1] || 'GENERAL';
      plan.pages.push({ legacyId: String(item.oldId), group, slug: uniqueSlug(row.alias || title, item.oldId, seen.pages), title, description, body, sortOrder: plan.pages.length, sourceMediaPaths: item.mediaPaths || [], ...timestamps });
    } else if (item.target === 'Publication') {
      const kind = item.reason.match(/kind: (NEWS|ARTICLE)/)?.[1] || 'ARTICLE';
      plan.publications.push({ legacyId: String(item.oldId), kind, slug: uniqueSlug(row.alias || title, item.oldId, seen.publications), title, excerpt: description, body, categoryName: item.theme, sourceMediaPaths: item.mediaPaths || [], ...timestamps });
    } else if (item.target === 'Project') {
      plan.projects.push({ legacyId: String(item.oldId), kind: 'PROGRAM', projectState: 'PLANNED', slug: uniqueSlug(row.alias || title, item.oldId, seen.projects), title, summary: description, body, sortOrder: plan.projects.length, sourceMediaPaths: item.mediaPaths || [], ...timestamps });
    }
  }

  return plan;
}

export function summarizePlan(plan) {
  return {
    organization: plan.organization ? 1 : 0,
    categories: plan.categories.length,
    pages: plan.pages.length,
    publications: plan.publications.length,
    projects: plan.projects.length,
    homeBlocks: plan.homeBlocks.length,
    total: (plan.organization ? 1 : 0) + plan.categories.length + plan.pages.length + plan.publications.length + plan.projects.length + plan.homeBlocks.length,
    missingSources: plan.missingSources.length,
    skipped: plan.skipped.length,
  };
}

function contentStatus(item, row) {
  const archived = item.sourceStatusLabel === 'корзина' || item.sourceStatusLabel === 'архив';
  return {
    status: archived ? 'ARCHIVED' : 'DRAFT',
    ...(archived && { deletedAt: legacyDate(row.modified || row.created) || new Date(0) }),
  };
}

export function extractContacts(value, legacyId = 'contact') {
  const text = htmlToText(value);
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const contacts = [];
  const addressLines = lines.slice(0, Math.max(0, lines.findIndex(line => /телефон/i.test(line))));
  if (addressLines.length) contacts.push({ legacyId: `${legacyId}-address`, type: 'ADDRESS', label: 'Адрес', value: addressLines.join(', ').slice(0, 500), href: null, isPublic: false, sortOrder: contacts.length });
  const phones = [...new Set(text.match(/(?:\+996\s*\d{3}\s*\d{2}[-\s]?\d{2}[-\s]?\d{2}|\(0\d{3}\)\s*\d{3}[-\s]?\d{3})/g) || [])];
  for (const phone of phones) {
    const digits = phone.replace(/\D/g, '');
    const normalized = phone.trim().startsWith('+') ? `+${digits}` : digits.startsWith('0') ? `+996${digits.slice(1)}` : `+${digits}`;
    contacts.push({ legacyId: `${legacyId}-phone-${contacts.length}`, type: 'PHONE', label: 'Телефон', value: phone.trim(), href: `tel:${normalized}`, isPublic: false, sortOrder: contacts.length });
  }
  const emails = [...new Set(text.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];
  for (const email of emails) contacts.push({ legacyId: `${legacyId}-email-${contacts.length}`, type: 'EMAIL', label: 'Электронная почта', value: email, href: `mailto:${email}`, isPublic: false, sortOrder: contacts.length });
  return contacts;
}

function extendedCommon(item, row, seen, collection) {
  const rawBody = `${row.introtext || ''}\n${row.fulltext || ''}`;
  const title = limit(row.title || item.title, 240, `Материал ${item.oldId}`);
  const description = limit(row.metadesc || row.introtext || rawBody, 1000, title);
  return {
    legacyId: String(item.oldId),
    slug: uniqueSlug(row.alias || title, item.oldId, seen[collection]),
    title,
    description,
    body: htmlToStructuredContent(rawBody, description),
    sourceMediaPaths: item.mediaPaths || [],
    ...contentStatus(item, row),
    ...sourceTimestamps(row),
  };
}

export function buildExtendedImportPlan({ sql, migrationData }) {
  const plan = buildImportPlan({ sql, migrationData });
  plan.children = [];
  plan.stories = [];
  plan.contacts = [];
  plan.hero = [];
  plan.media = {
    files: migrationData.media?.files || [],
    missingRefs: migrationData.media?.missingRefs || [],
    dangerous: migrationData.media?.dangerous || [],
  };
  plan.unassigned = migrationData.unassigned || [];

  const contentRows = parseRows(sql, 'chdg4_content');
  const contentById = new Map(contentRows.map(row => [String(row.id), row]));
  const existing = {
    publications: new Set(plan.publications.map(item => item.legacyId)),
    projects: new Set(plan.projects.map(item => item.legacyId)),
    pages: new Set(plan.pages.map(item => item.legacyId)),
  };
  const seen = {
    publications: new Set(plan.publications.map(item => item.slug)),
    projects: new Set(plan.projects.map(item => item.slug)),
    pages: new Set(plan.pages.map(item => item.slug)),
    children: new Set(),
    stories: new Set(),
  };

  for (const item of migrationData.distributed) {
    const row = contentById.get(String(item.oldId));
    if (item.target === 'ContactEntry' && row) {
      plan.contacts.push(...extractContacts(`${row.introtext || ''}\n${row.fulltext || ''}`, item.oldId));
      continue;
    }
    if (!row) continue;
    if (item.target === 'Publication' && !existing.publications.has(String(item.oldId))) {
      const common = extendedCommon(item, row, seen, 'publications');
      const kind = item.reason.match(/kind: (NEWS|ARTICLE)/)?.[1] || 'ARTICLE';
      plan.publications.push({ legacyId: common.legacyId, kind, slug: common.slug, title: common.title, excerpt: common.description, body: common.body, categoryName: item.theme, sourceMediaPaths: common.sourceMediaPaths, status: common.status, ...(common.deletedAt && { deletedAt: common.deletedAt }), ...(common.createdAt && { createdAt: common.createdAt }), ...(common.updatedAt && { updatedAt: common.updatedAt }) });
    } else if (item.target === 'Project' && !existing.projects.has(String(item.oldId))) {
      const common = extendedCommon(item, row, seen, 'projects');
      plan.projects.push({ legacyId: common.legacyId, kind: 'PROGRAM', projectState: 'PLANNED', slug: common.slug, title: common.title, summary: common.description, body: common.body, sortOrder: plan.projects.length, sourceMediaPaths: common.sourceMediaPaths, status: common.status, ...(common.deletedAt && { deletedAt: common.deletedAt }), ...(common.createdAt && { createdAt: common.createdAt }), ...(common.updatedAt && { updatedAt: common.updatedAt }) });
    } else if (item.target === 'InfoPage' && !existing.pages.has(String(item.oldId))) {
      const common = extendedCommon(item, row, seen, 'pages');
      const group = item.reason.match(/раздела (ABOUT|GIVE_HELP|GET_HELP|GENERAL)/)?.[1] || 'GENERAL';
      plan.pages.push({ legacyId: common.legacyId, group, slug: common.slug, title: common.title, description: common.description, body: common.body, sortOrder: plan.pages.length, sourceMediaPaths: common.sourceMediaPaths, status: common.status, ...(common.deletedAt && { deletedAt: common.deletedAt }), ...(common.createdAt && { createdAt: common.createdAt }), ...(common.updatedAt && { updatedAt: common.updatedAt }) });
    } else if (item.target === 'ChildProfile') {
      const common = extendedCommon(item, row, seen, 'children');
      plan.children.push({ legacyId: common.legacyId, slug: common.slug, publicDisplayName: common.title.slice(0, 120), title: common.title, summary: common.description, storyBody: common.body, publicAgeLabel: null, approvedHealthSummary: common.description, supportReason: common.description, sortOrder: plan.children.length, sourceMediaPaths: common.sourceMediaPaths, status: common.status, ...(common.deletedAt && { deletedAt: common.deletedAt }), ...(common.createdAt && { createdAt: common.createdAt }), ...(common.updatedAt && { updatedAt: common.updatedAt }) });
    } else if (item.target === 'Story') {
      const common = extendedCommon(item, row, seen, 'stories');
      plan.stories.push({ legacyId: common.legacyId, slug: common.slug, title: common.title, excerpt: common.description, body: common.body, sourceMediaPaths: common.sourceMediaPaths, status: common.status, ...(common.deletedAt && { deletedAt: common.deletedAt }), ...(common.createdAt && { createdAt: common.createdAt }), ...(common.updatedAt && { updatedAt: common.updatedAt }) });
    }
  }

  const pageBuilder = parseRows(sql, 'chdg4_sppagebuilder').find(row => row.id === '1');
  const heroRecord = migrationData.distributed.find(item => item.target === 'HeroSlide');
  if (pageBuilder && heroRecord) {
    try {
      const sections = JSON.parse(pageBuilder.text || '[]');
      const settings = sections[0]?.settings || {};
      const heading = sections[0]?.columns?.[0]?.addons?.[0]?.settings || {};
      if (settings.background_external_video) plan.hero.push({
        legacyId: String(heroRecord.oldId),
        title: null,
        subtitle: limit(`${heading.animated_text || ''} ${heading.heading_after_part || ''}`.trim(), 1000, heroRecord.title),
        externalUrl: settings.background_external_video,
        posterPath: settings.background_image || null,
        altText: 'Видео фонда Help The Children',
        isDecorative: false,
        position: 0,
        status: 'DRAFT',
      });
    } catch { plan.skipped.push({ target: 'HeroSlide', reason: 'Некорректный JSON старой главной страницы.' }); }
  }
  return plan;
}

export function summarizeExtendedPlan(plan) {
  return {
    ...summarizePlan(plan),
    children: plan.children.length,
    stories: plan.stories.length,
    contacts: plan.contacts.length,
    hero: plan.hero.length,
    mediaFiles: plan.media.files.length,
    mediaBytes: plan.media.files.reduce((total, item) => total + Number(item.size || 0), 0),
    missingRefs: plan.media.missingRefs.length,
    dangerousFiles: plan.media.dangerous.length,
    unassigned: plan.unassigned.length,
    totalContent: (plan.organization ? 1 : 0) + plan.categories.length + plan.pages.length + plan.publications.length + plan.projects.length + plan.homeBlocks.length + plan.children.length + plan.stories.length + plan.contacts.length + plan.hero.length,
  };
}
