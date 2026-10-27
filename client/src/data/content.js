const placeholder = (label, background = '#DFF1FF') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="${background}"/><circle cx="930" cy="190" r="170" fill="#F5D300" opacity=".55"/><path d="M0 650 310 390l210 170 250-280 430 370v150H0Z" fill="#3B7EDB" opacity=".18"/><text x="70" y="110" fill="#25334A" font-family="Arial,sans-serif" font-size="38">${label}</text><text x="70" y="160" fill="#25334A" opacity=".7" font-family="Arial,sans-serif" font-size="22">демонстрационное изображение</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const organization = {
  id: 'organization',
  slug: 'about',
  title: 'Наша организация',
  description: 'Временный нейтральный текст. Здесь будет размещена проверенная информация об организации, её команде и принципах работы.',
  category: 'Организация',
  status: 'draft',
  isDemo: true,
};

export const hero = [
  { id: 'hero-1', slug: 'welcome', title: null, description: 'Мы создаём пространство, где помощь детям становится понятной, бережной и доступной.', image: placeholder('Вместе можем больше', '#DFF1FF'), category: 'О нас', status: 'demo', isDemo: true },
  { id: 'hero-2', slug: 'programs', title: 'Программы помощи', description: 'Здесь появится информация о действующих программах и подтверждённых результатах.', image: placeholder('Программы помощи', '#FFF3D6'), category: 'Проекты', status: 'demo', isDemo: true },
  { id: 'hero-3', slug: 'updates', title: 'Новости организации', description: 'Раздел подготовлен для новостей, отчётов и полезных материалов.', image: placeholder('Новости', '#EAF4FF'), category: 'Публикации', status: 'demo', isDemo: true },
];

export const children = [
  { id: 'demo-child-1', slug: 'demo-support-story-1', title: 'Демонстрационная карточка ребёнка', name: 'Тестовая запись № 1', description: 'Пример структуры карточки. Реальные персональные данные не опубликованы.', disease: 'Информация будет добавлена после проверки', age: null, supportReason: 'Демонстрация интерфейса', image: placeholder('Тестовая карточка', '#DFF1FF'), category: 'Нужна помощь', status: 'demo', isDemo: true },
  { id: 'demo-child-2', slug: 'demo-support-story-2', title: 'Демонстрационная карточка ребёнка', name: 'Тестовая запись № 2', description: 'Нейтральная запись для проверки списка, страницы материала и пустых состояний.', disease: 'Информация будет добавлена после проверки', age: null, supportReason: 'Демонстрация интерфейса', image: placeholder('Тестовая карточка', '#FFF3D6'), category: 'Нужна помощь', status: 'demo', isDemo: true },
];

export const publications = [
  { id: 'demo-publication-1', slug: 'welcome-publication', title: 'Как будет работать раздел публикаций', description: 'Демонстрационный материал о будущих новостях, отчётах и полезных статьях организации.', excerpt: 'Здесь будут появляться проверенные новости и материалы.', body: 'Это тестовая публикация. После запуска контентного процесса её нужно заменить собственным материалом организации.', category: 'Новости', date: '2026-10-01', image: placeholder('Публикация', '#EAF4FF'), status: 'demo', isDemo: true },
  { id: 'demo-publication-2', slug: 'transparent-help', title: 'Принципы прозрачной помощи', description: 'Тестовая статья, демонстрирующая карточку и фильтрацию публикаций.', excerpt: 'Пример материала для раздела статей.', body: 'На этой странице будет размещён собственный редакционный материал организации.', category: 'Статьи', date: '2026-09-15', image: placeholder('Статья', '#FFF3D6'), status: 'demo', isDemo: true },
];

export const stories = [
  { id: 'demo-story-1', slug: 'first-demo-story', title: 'Тестовая история поддержки', description: 'Нейтральная демонстрационная история без персональных данных реальных людей.', excerpt: 'Пример будущей истории.', body: 'Это демонстрационная запись. Реальные истории публикуются только после получения согласий и редакционной проверки.', category: 'Истории', date: '2026-08-20', image: placeholder('История', '#E7F0FF'), status: 'demo', isDemo: true },
];

export const projects = [
  { id: 'demo-project-1', slug: 'family-support', title: 'Поддержка семей', description: 'Демонстрационная программа комплексной информационной поддержки.', summary: 'Пример описания программы.', body: 'Параметры, сроки и результаты программы будут добавлены после утверждения.', image: placeholder('Поддержка семей', '#FFF3D6'), category: 'Проекты', status: 'demo', isDemo: true },
  { id: 'demo-project-2', slug: 'volunteer-program', title: 'Волонтёрская программа', description: 'Демонстрационный раздел о возможностях безопасного волонтёрства.', summary: 'Пример волонтёрской программы.', body: 'Условия участия и контакты появятся после запуска программы.', image: placeholder('Волонтёрство', '#EAF4FF'), category: 'Программы', status: 'demo', isDemo: true },
  { id: 'demo-project-3', slug: 'educational-meetings', title: 'Образовательные встречи', description: 'Тестовая инициатива для проверки вкладок и страниц проектов.', summary: 'Пример инициативы.', body: 'Расписание и формат встреч пока не утверждены.', image: placeholder('Встречи', '#DFF1FF'), category: 'Инициативы', status: 'demo', isDemo: true },
];

export const helpMethods = [
  { id: 'help-children', slug: 'support-children', to: '/children', title: 'Помочь детям', description: 'Посмотреть демонстрационный список карточек и будущие направления адресной помощи.', instructions: 'Выберите направление поддержки в разделе о детях.', category: 'Адресная помощь', status: 'draft', isDemo: true },
  { id: 'help-volunteer', slug: 'volunteer', to: '/give-help/volunteer', title: 'Стать волонтёром', description: 'Узнать, как будет устроено участие волонтёров.', instructions: 'Приём заявок пока не открыт.', category: 'Участие', status: 'draft', isDemo: true },
  { id: 'help-company', slug: 'for-companies', to: '/give-help/for-companies', title: 'Для компаний', description: 'Будущие форматы сотрудничества для организаций.', instructions: 'Контактные данные будут опубликованы после подтверждения.', category: 'Партнёрство', status: 'draft', isDemo: true },
];

export const getHelpDirections = [
  { id: 'get-help-request', slug: 'request-help', title: 'Как обратиться за помощью', description: 'Порядок обращения находится в подготовке. Форма не собирает и не отправляет данные.', category: 'Обращение', status: 'draft', isDemo: true },
  { id: 'get-help-documents', slug: 'required-documents', title: 'Необходимые документы', description: 'Будущий список документов и правила безопасной передачи данных.', category: 'Документы', status: 'draft', isDemo: true },
  { id: 'get-help-questions', slug: 'common-questions', title: 'Частые вопросы', description: 'Ответы на типовые вопросы появятся после утверждения программы.', category: 'Информация', status: 'draft', isDemo: true },
];

export const organizationSections = [
  { id: 'org-about', slug: 'about', title: 'Об организации', description: organization.description, category: 'Организация', status: 'draft', isDemo: true },
  { id: 'org-team', slug: 'team', title: 'Команда', description: 'Информация о команде будет добавлена после согласования.', category: 'Организация', status: 'draft', isDemo: true },
  { id: 'org-reports', slug: 'reports', title: 'Отчётность', description: 'Проверенные отчёты будут опубликованы в этом разделе.', category: 'Документы', status: 'draft', isDemo: true },
];

export const contacts = [
  { id: 'contact-main', slug: 'contacts', title: 'Контакты', description: 'Адрес, телефон и электронная почта будут опубликованы после подтверждения организацией.', category: 'Контакты', status: 'draft', isDemo: true },
];

export const navigation = [
  { title: 'Кто мы', to: '/who-we' },
  { title: 'Что мы делаем', to: '/what-we-do' },
  { title: 'Помочь', to: '/give-help' },
  { title: 'Получить помощь', to: '/get-help' },
  { title: 'Дети', to: '/children' },
  { title: 'Публикации', to: '/publications' },
  { title: 'Истории', to: '/stories' },
  { title: 'Контакты', to: '/contacts' },
];

export const contentCollections = { children, publications, stories, projects, helpMethods, getHelpDirections, organizationSections, contacts, hero };
