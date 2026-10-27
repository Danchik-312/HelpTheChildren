import { childrenApi, pagesApi, projectsApi, storiesApi } from '../api/contentApi';

export const emptyDocument = { type: 'doc', content: [{ type: 'paragraph' }] };

export const normalizeDocument = value => {
  if (value?.type === 'doc' && Array.isArray(value.content)) return value;
  if (Array.isArray(value)) return { type: 'doc', content: value.map(node => node?.type === 'paragraph' && typeof node.text === 'string' ? { type: 'paragraph', content: node.text ? [{ type: 'text', text: node.text }] : undefined } : node) };
  return emptyDocument;
};

const common = { title: '', slug: '', coverMediaId: null };

export const resourceDefinitions = {
  stories: {
    api: storiesApi, area: 'STORIES', title: 'Истории', singular: 'история', summaryField: 'excerpt', bodyField: 'body',
    initial: { ...common, excerpt: '', body: emptyDocument, consentConfirmed: false },
    fields: ['title', 'slug', 'excerpt', 'body', 'coverMediaId', 'consentConfirmed'],
  },
  projects: {
    api: projectsApi, area: 'PROJECTS', title: 'Проекты и программы', singular: 'проект', summaryField: 'summary', bodyField: 'body', filter: 'kind',
    filterOptions: { PROJECT: 'Проект', PROGRAM: 'Программа', INITIATIVE: 'Инициатива' },
    initial: { ...common, kind: 'PROJECT', projectState: 'PLANNED', summary: '', body: emptyDocument, startsAt: null, endsAt: null, sortOrder: 0 },
    fields: ['title', 'slug', 'kind', 'projectState', 'summary', 'body', 'startsAt', 'endsAt', 'sortOrder', 'coverMediaId'],
  },
  pages: {
    api: pagesApi, area: 'PAGES', title: 'Информационные страницы', singular: 'страница', summaryField: 'description', bodyField: 'body', filter: 'group',
    filterOptions: { ABOUT: 'О нас', GIVE_HELP: 'Хочу помочь', GET_HELP: 'Нужна помощь', GENERAL: 'Общее' },
    initial: { ...common, group: 'GENERAL', description: '', body: emptyDocument, sortOrder: 0 },
    fields: ['title', 'slug', 'group', 'description', 'body', 'sortOrder', 'coverMediaId'],
  },
  children: {
    api: childrenApi, area: 'CHILDREN', title: 'Дети', singular: 'карточка ребёнка', summaryField: 'summary', bodyField: 'storyBody',
    initial: { ...common, publicDisplayName: '', summary: '', storyBody: emptyDocument, publicAgeLabel: null, approvedHealthSummary: null, supportReason: '', sortOrder: 0 },
    fields: ['title', 'slug', 'publicDisplayName', 'summary', 'storyBody', 'publicAgeLabel', 'approvedHealthSummary', 'supportReason', 'sortOrder', 'coverMediaId'],
  },
};

export const statusLabels = { DRAFT: 'Черновик', PUBLISHED: 'Опубликовано', ARCHIVED: 'В архиве' };

export function editableData(definition, form) {
  const nullable = ['coverMediaId', 'publicAgeLabel', 'approvedHealthSummary', 'startsAt', 'endsAt'];
  return Object.fromEntries(definition.fields.map(field => [field, form[field] ?? (nullable.includes(field) ? null : form[field])]));
}
