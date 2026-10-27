import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicationsPage from './PublicationsPage/PublicationsPage';
import WhatWeDoPage from './WhatWeDoPage/WhatWeDoPage';
import { projects, publications } from '../data/content';

jest.mock('react-router/dom', () => {
  const { TextDecoder, TextEncoder } = require('util');
  global.TextDecoder = TextDecoder;
  global.TextEncoder = TextEncoder;
  return require('react-router/dist/development/dom-export.js');
}, { virtual: true });
jest.mock('../hooks/useReducedMotion', () => () => true);

beforeEach(() => {
  global.fetch = jest.fn(async input => {
    const url = new URL(input);
    const publicationItems = publications.map(item => ({ id: item.id, slug: item.slug, title: item.title, excerpt: item.excerpt, body: { type: 'doc', content: [] }, kind: item.category === 'Новости' ? 'NEWS' : 'ARTICLE', publishedAt: '2026-10-01T00:00:00.000Z', coverMedia: null }));
    const projectItems = projects.map((item, index) => ({ id: item.id, slug: item.slug, title: item.title, summary: item.summary, body: { type: 'doc', content: [] }, kind: ['PROJECT', 'PROGRAM', 'INITIATIVE'][index], publishedAt: '2026-10-01T00:00:00.000Z', coverMedia: null }));
    const data = url.pathname.endsWith('/public/publications')
      ? { items: publicationItems.filter(item => !url.searchParams.get('kind') || item.kind === url.searchParams.get('kind')) }
      : url.pathname.endsWith('/public/projects')
        ? { items: projectItems.filter(item => !url.searchParams.get('kind') || item.kind === url.searchParams.get('kind')) }
        : { items: [] };
    return { ok: true, json: async () => ({ data }) };
  });
});

describe('content filters', () => {
  test('filters publications by category', async () => {
    render(<MemoryRouter><PublicationsPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: publications[0].title })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: publications[1].title })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Статьи' }));

    expect(screen.queryByRole('heading', { name: publications[0].title })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: publications[1].title })).toBeInTheDocument();
  });

  test('switches project categories and updates the linked cards', async () => {
    render(<MemoryRouter><WhatWeDoPage /></MemoryRouter>);

    expect(await screen.findByRole('link', { name: /Поддержка семей/ })).toHaveAttribute('href', '/projects/family-support');

    fireEvent.click(screen.getByRole('button', { name: 'Программы' }));

    const programLink = await screen.findByRole('link', { name: /Волонтёрская программа/ });
    expect(programLink).toHaveAttribute('href', `/projects/${projects[1].slug}`);
    expect(screen.queryByRole('link', { name: /Поддержка семей/ })).not.toBeInTheDocument();

    const filters = screen.getByRole('group', { name: 'Фильтры материалов' });
    expect(within(filters).getByRole('button', { name: 'Программы' })).toHaveAttribute('aria-pressed', 'true');
  });
});
