import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { children, contacts, publications } from './data/content';

jest.mock('react-router/dom', () => {
  const { TextDecoder, TextEncoder } = require('util');
  global.TextDecoder = TextDecoder;
  global.TextEncoder = TextEncoder;
  return require('react-router/dist/development/dom-export.js');
}, { virtual: true });
jest.mock('./hooks/useReducedMotion', () => () => true);

beforeEach(() => {
  window.scrollTo = jest.fn();
  global.fetch = jest.fn(async input => {
    const url = new URL(input);
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Проверенный текст' }] }] };
    let data = { items: [] };
    if (url.pathname.endsWith('/public/children')) data = { items: children.map(item => ({ id: item.id, slug: item.slug, title: item.title, publicDisplayName: item.name, summary: item.description, supportReason: item.supportReason, approvedHealthSummary: item.disease, publicAgeLabel: item.age, storyBody: body, coverMedia: null })) };
    else if (url.pathname.endsWith('/public/publications')) data = { items: publications.map(item => ({ id: item.id, slug: item.slug, title: item.title, excerpt: item.excerpt, body, kind: item.category === 'Новости' ? 'NEWS' : 'ARTICLE', publishedAt: '2026-10-01T00:00:00.000Z', coverMedia: null })) };
    else if (url.pathname === '/api/v1/public/site') data = { contacts: contacts.map(item => ({ id: item.slug, label: item.title, value: item.description, type: 'INFO', href: '/contacts' })) };
    else if (url.pathname.endsWith('/publications/welcome-publication')) data = { id: publications[0].id, slug: publications[0].slug, title: publications[0].title, excerpt: publications[0].excerpt, body, kind: 'NEWS', publishedAt: '2026-10-01T00:00:00.000Z', coverMedia: null };
    else if (url.pathname.endsWith('/publications/transparent-help')) data = { id: publications[1].id, slug: publications[1].slug, title: publications[1].title, excerpt: publications[1].excerpt, body, kind: 'ARTICLE', publishedAt: '2026-10-01T00:00:00.000Z', coverMedia: null };
    else if (url.pathname.startsWith('/api/v1/public/publications/')) data = null;
    else if (url.pathname.includes('/public/children/')) { const item = children.find(child => url.pathname.endsWith(child.slug)); data = item ? { id: item.id, slug: item.slug, title: item.title, publicDisplayName: item.name, summary: item.description, supportReason: item.supportReason, approvedHealthSummary: item.disease, publicAgeLabel: item.age, storyBody: body, coverMedia: null } : null; }
    else if (url.pathname === '/api/v1/public/pages' && url.searchParams.get('group') === 'GIVE_HELP') data = { items: [{ id: 'help-children', slug: 'support-children', title: 'Помочь детям', description: 'Посмотреть опубликованные карточки помощи.', group: 'GIVE_HELP', body }] };
    else if (url.pathname === '/api/v1/public/pages' && url.searchParams.get('group') === 'GENERAL') data = { items: [{ id: 'general-1', slug: 'annual-report', title: 'Годовой отчёт', description: 'Информационный материал.', group: 'GENERAL', body }] };
    else if (url.pathname.endsWith('/public/pages/GENERAL/annual-report')) data = { id: 'general-1', slug: 'annual-report', title: 'Годовой отчёт', description: 'Информационный материал.', group: 'GENERAL', body };
    return { ok: true, json: async () => ({ data }) };
  });
});

function renderRoute(path) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('application routes', () => {
  test('renders a collection route from repository data', async () => {
    renderRoute('/children');

    expect(await screen.findByRole('heading', { name: 'Дети, которым нужна помощь' })).toBeInTheDocument();
    expect(await screen.findAllByText(children[0].name)).not.toHaveLength(0);
  });

  test('renders a detail route and its local back link', async () => {
    const article = publications[0];
    renderRoute(`/publications/${article.slug}`);

    expect(await screen.findByRole('heading', { name: article.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /к публикациям/i })).toHaveAttribute('href', '/publications');
  });

  test('renders contact and child details without self-referencing list links', async () => {
    renderRoute(`/contacts/${contacts[0].slug}`);
    expect(await screen.findByRole('heading', { name: contacts[0].title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /к контактам/i })).toHaveAttribute('href', '/contacts');

    renderRoute(`/children/${children[0].slug}`);
    expect(await screen.findByRole('heading', { name: children[0].name })).toBeInTheDocument();
    expect(screen.getByText(children[0].disease)).toBeInTheDocument();
  });

  test('keeps the help route informational and free of payment controls', async () => {
    renderRoute('/give-help');

    expect(await screen.findByRole('heading', { name: 'Помочь' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /^Помочь детям / })).toHaveAttribute('href', '/give-help/support-children');
    expect(screen.queryByRole('button', { name: /пожертв/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/плат[её]ж/i)).not.toBeInTheDocument();
  });

  test('renders GENERAL information list and detail routes', async () => {
    const list = renderRoute('/information');
    expect(await screen.findByRole('link', { name: /Годовой отчёт/ })).toHaveAttribute('href', '/information/annual-report');
    list.unmount();

    renderRoute('/information/annual-report');
    expect(await screen.findByRole('heading', { name: 'Годовой отчёт' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /к информационным материалам/i })).toHaveAttribute('href', '/information');
  });

  test.each([
    '/publications/not-a-real-slug',
    '/not-a-real-route',
  ])('renders the 404 state for %s', async path => {
    renderRoute(path);

    expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /вернуться на главную/i })).toHaveAttribute('href', '/');
  });
});
