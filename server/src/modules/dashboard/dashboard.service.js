import { prisma } from '../../db/prisma.js';

const resourceAreas = {
  Publication: 'PUBLICATIONS',
  Story: 'STORIES',
  ChildProfile: 'CHILDREN',
  Project: 'PROJECTS',
  InfoPage: 'PAGES',
};

const canRead = (user, area) => user?.role === 'ADMIN' || Boolean(user?.permissions?.some(permission => permission.area === area));

export async function getDashboard(user) {
  const allowed = Object.fromEntries(Object.entries(resourceAreas).map(([entity, area]) => [entity, canRead(user, area)]));
  const enabledEntities = Object.keys(allowed).filter(entity => allowed[entity]);
  const count = (delegate, where) => enabledEntities.includes(where.entity)
    ? delegate.count({ where: { status: where.status, deletedAt: null } })
    : Promise.resolve(0);
  const [publishedPublications, publishedStories, publishedChildren, publishedProjects, publishedPages, draftPublications, draftStories, draftChildren, draftProjects, draftPages, children, projects, recentChanges, recentPublished] = await Promise.all([
    count(prisma.publication, { entity: 'Publication', status: 'PUBLISHED' }),
    count(prisma.story, { entity: 'Story', status: 'PUBLISHED' }),
    count(prisma.childProfile, { entity: 'ChildProfile', status: 'PUBLISHED' }),
    count(prisma.project, { entity: 'Project', status: 'PUBLISHED' }),
    count(prisma.infoPage, { entity: 'InfoPage', status: 'PUBLISHED' }),
    count(prisma.publication, { entity: 'Publication', status: 'DRAFT' }),
    count(prisma.story, { entity: 'Story', status: 'DRAFT' }),
    count(prisma.childProfile, { entity: 'ChildProfile', status: 'DRAFT' }),
    count(prisma.project, { entity: 'Project', status: 'DRAFT' }),
    count(prisma.infoPage, { entity: 'InfoPage', status: 'DRAFT' }),
    canRead(user, 'CHILDREN') ? prisma.childProfile.count({ where: { deletedAt: null } }) : Promise.resolve(0),
    canRead(user, 'PROJECTS') ? prisma.project.count({ where: { deletedAt: null } }) : Promise.resolve(0),
    prisma.auditLog.findMany({ where: { ...(user?.role === 'ADMIN' ? {} : { entityType: { in: enabledEntities } }) }, take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, entityType: true, entityId: true, summary: true, createdAt: true, actor: { select: { id: true, displayName: true } } } }),
    canRead(user, 'PUBLICATIONS') ? prisma.publication.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, take: 10, orderBy: { publishedAt: 'desc' }, select: { id: true, kind: true, slug: true, title: true, publishedAt: true } }) : Promise.resolve([]),
  ]);
  return {
    counts: {
      published: publishedPublications + publishedStories + publishedChildren + publishedProjects + publishedPages,
      drafts: draftPublications + draftStories + draftChildren + draftProjects + draftPages,
      children,
      projects,
    },
    recentChanges: recentChanges.map(item => ({ ...item, id: item.id.toString() })),
    recentPublished,
  };
}
