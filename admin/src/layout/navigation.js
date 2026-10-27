export const navigationGroups = [
  {
    label: 'Управление сайтом',
    items: [
      { label: 'Hero и баннеры', to: '/hero', area: 'HERO' },
      { label: 'Контакты', to: '/settings/contacts', area: 'SITE' },
      { label: 'Об организации', to: '/settings/organization', area: 'SITE' },
      { label: 'Блоки главной', to: '/settings/home', area: 'SITE' },
      { label: 'Пользователи и роли', to: '/users', adminOnly: true },
      { label: 'Журнал аудита', to: '/audit-log', adminOnly: true },
    ],
  },
  {
    label: 'Контент',
    items: [
      { label: 'Новости', to: '/publications?kind=NEWS', area: 'PUBLICATIONS' },
      { label: 'Статьи / публикации', to: '/publications?kind=ARTICLE', area: 'PUBLICATIONS' },
      { label: 'Категории публикаций', to: '/categories', adminOnly: true },
      { label: 'Истории', to: '/stories', area: 'STORIES' },
      { label: 'Дети', to: '/children', area: 'CHILDREN' },
      { label: 'Проекты и программы', to: '/projects', area: 'PROJECTS' },
      { label: 'Страницы', to: '/pages', area: 'PAGES' },
      { label: 'Медиатека', to: '/media', area: 'MEDIA' },
    ],
  },
];
