import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { contentPublicRouter } from '../modules/content/content.routes.js';
import { categoriesPublicRouter } from '../modules/categories/categories.routes.js';
import { heroPublicRouter } from '../modules/hero/hero.routes.js';
import { mediaPublicRouter } from '../modules/media/media.routes.js';
import { sitePublicRouter } from '../modules/site/site.routes.js';

export const publicRouter = Router();
const infoPageRouteBases = Object.freeze({ ABOUT: '/who-we', GIVE_HELP: '/give-help', GET_HELP: '/get-help', GENERAL: '/information' });
export function infoPagePublicUrl(page) {
  if (page.group === 'GENERAL' && page.slug === 'partners') return '/partners';
  const base = infoPageRouteBases[page.group];
  return base ? `${base}/${page.slug}` : null;
}
publicRouter.use('/hero-slides', heroPublicRouter);
publicRouter.use('/media', mediaPublicRouter);
publicRouter.use('/categories', categoriesPublicRouter);
publicRouter.use('/site', sitePublicRouter);
publicRouter.get('/homepage', asyncHandler(async (_req, res) => {
  const items = await prisma.homeBlock.findMany({ where: { enabled: true }, select: { key: true, enabled: true, position: true, itemLimit: true, heading: true, description: true, config: true }, orderBy: { position: 'asc' } });
  res.json({ data: { items } });
}));
for (const resource of ['publications', 'stories', 'children', 'projects', 'pages']) publicRouter.use(`/${resource}`, contentPublicRouter(resource));

publicRouter.get('/navigation', (_req, res) => res.json({ data: { items: [
  { key: 'who-we', label: 'Кто мы', url: '/who-we' }, { key: 'what-we-do', label: 'Что мы делаем', url: '/what-we-do' },
  { key: 'give-help', label: 'Помочь', url: '/give-help' }, { key: 'get-help', label: 'Получить помощь', url: '/get-help' },
  { key: 'children', label: 'Дети', url: '/children' }, { key: 'publications', label: 'Публикации', url: '/publications' },
  { key: 'stories', label: 'Истории', url: '/stories' },
  { key: 'information', label: 'Информация', url: '/information' },
  { key: 'partners', label: 'Партнёры', url: '/partners' },
] } }));

publicRouter.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 120);
  if (!q) return res.json({ data: { items: [] } });
  const published = { status: 'PUBLISHED', publishedAt: { lte: new Date() }, deletedAt: null, title: { contains: q, mode: 'insensitive' } };
  const childrenWhere = published;
  const [publications, stories, childCandidates, projects, pages] = await prisma.$transaction([
    prisma.publication.findMany({ where: published, take: 10, select: { title: true, slug: true, excerpt: true } }),
    prisma.story.findMany({ where: published, take: 10, select: { title: true, slug: true, excerpt: true } }),
    prisma.childProfile.findMany({
      where: childrenWhere,
      select: {
        title: true, slug: true, summary: true, publicDisplayName: true, storyBody: true,
        publicAgeLabel: true, approvedHealthSummary: true, supportReason: true, coverMediaId: true,
      },
    }),
    prisma.project.findMany({ where: published, take: 10, select: { title: true, slug: true, summary: true } }),
    prisma.infoPage.findMany({ where: { ...published, group: { in: ['ABOUT', 'GIVE_HELP', 'GET_HELP', 'GENERAL'] } }, take: 10, select: { title: true, slug: true, group: true, description: true } }),
  ]);
  const children = childCandidates.slice(0, 10);
  const items = [
    ...publications.map(item => ({ title: item.title, description: item.excerpt, url: `/publications/${item.slug}` })),
    ...stories.map(item => ({ title: item.title, description: item.excerpt, url: `/stories/${item.slug}` })),
    ...children.map(item => ({ title: item.title, description: item.summary, url: `/children/${item.slug}` })),
    ...projects.map(item => ({ title: item.title, description: item.summary, url: `/projects/${item.slug}` })),
    ...pages.map(item => ({
      title: item.title,
      description: item.description,
      url: infoPagePublicUrl(item),
    })),
  ].slice(0, 20);
  res.json({ data: { items } });
}));
