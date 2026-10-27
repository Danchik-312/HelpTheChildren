export const contentConfig = Object.freeze({
  publications: { delegate: 'publication', model: 'Publication', area: 'PUBLICATIONS', orderBy: { updatedAt: 'desc' } },
  stories: { delegate: 'story', model: 'Story', area: 'STORIES', orderBy: { updatedAt: 'desc' } },
  children: { delegate: 'childProfile', model: 'ChildProfile', area: 'CHILDREN', orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] },
  projects: { delegate: 'project', model: 'Project', area: 'PROJECTS', orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] },
  pages: { delegate: 'infoPage', model: 'InfoPage', area: 'PAGES', orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] },
});
