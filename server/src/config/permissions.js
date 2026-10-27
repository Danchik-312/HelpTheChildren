export const areaForResource = Object.freeze({
  publications: 'PUBLICATIONS',
  stories: 'STORIES',
  children: 'CHILDREN',
  projects: 'PROJECTS',
  pages: 'PAGES',
  'hero-slides': 'HERO',
  media: 'MEDIA',
  site: 'SITE',
});

export function hasPermission(user, area, action = 'write') {
  if (user.role === 'ADMIN') return true;
  const permission = user.permissions?.find(item => item.area === area);
  if (!permission) return false;
  return action !== 'publish' || permission.canPublish;
}
