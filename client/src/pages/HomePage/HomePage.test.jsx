import { vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import HomePage from './HomePage';

vi.mock('../../components/Hero/Hero', () => ({ default: () => <div data-testid="hero" /> }));
vi.mock('../../components/ChildrenSection/ChildrenSection', () => ({ default: props => <div data-testid="children" data-limit={props.itemLimit} data-description={props.description} data-config={JSON.stringify(props.config)}>{props.heading}</div> }));
vi.mock('../../components/HelpSection/HelpSection', () => ({ default: props => <div data-testid="help">{props.heading}</div> }));
vi.mock('../../components/ProjectsSection/ProjectsSection', () => ({ default: props => <div data-testid="projects">{props.heading}</div> }));
vi.mock('../../components/NewsSection/NewsSection', () => ({ default: props => <div data-testid="publications">{props.heading}</div> }));
vi.mock('../../components/FriendsSection/FriendsSection', () => ({ default: props => <div data-testid="friends">{props.heading}</div> }));

const sectionOrder = container => [...container.querySelectorAll('[data-testid]')].map(node => node.dataset.testid);
const respondWith = items => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items } }) });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('renders every standard homepage section in its original order for an empty CMS response', async () => {
  respondWith([]);
  const { container } = render(<HomePage />);
  await screen.findByTestId('children');
  expect(sectionOrder(container)).toEqual(['hero', 'children', 'help', 'projects', 'publications', 'friends']);
});

test('renders a non-empty CMS response in the supplied order', async () => {
  respondWith([
    { key: 'publications', position: 1, heading: 'Новости' },
    { key: 'projects', position: 2, heading: 'Наши проекты' },
    { key: 'children', position: 3, heading: 'Помочь детям' },
  ]);
  const { container } = render(<HomePage />);
  expect(await screen.findByTestId('publications')).toHaveTextContent('Новости');
  expect(sectionOrder(container)).toEqual(['hero', 'publications', 'projects', 'children']);
});

test('renders only blocks included in a partial CMS configuration', async () => {
  respondWith([
    { key: 'projects', position: 1, heading: 'Наши проекты' },
    { key: 'children', position: 2, heading: 'Помочь детям' },
  ]);
  render(<HomePage />);
  expect(await screen.findByTestId('projects')).toHaveTextContent('Наши проекты');
  expect(screen.getByTestId('children')).toHaveTextContent('Помочь детям');
  expect(screen.queryByTestId('publications')).not.toBeInTheDocument();
  expect(screen.queryByTestId('help')).not.toBeInTheDocument();
  expect(screen.queryByTestId('friends')).not.toBeInTheDocument();
});

test('ignores an unknown block type without breaking known sections', async () => {
  respondWith([
    { key: 'unknown', position: 1 },
    { key: 'help', position: 2, heading: 'Как помочь' },
  ]);
  const { container } = render(<HomePage />);
  expect(await screen.findByTestId('help')).toHaveTextContent('Как помочь');
  expect(sectionOrder(container)).toEqual(['hero', 'help']);
});


test('passes CMS section parameters and alternates known blocks without counting unknown ones', async () => {
  respondWith([
    { key: 'children', heading: 'Дети', description: 'Текст из CMS', itemLimit: 3, config: { compact: true } },
    { key: 'unknown' },
    { key: 'help', heading: 'Помочь' },
    { key: 'projects', heading: 'Проекты' },
  ]);
  const { container } = render(<HomePage />);
  const childrenBlock = await screen.findByTestId('children');
  expect(childrenBlock).toHaveAttribute('data-limit', '3');
  expect(childrenBlock).toHaveAttribute('data-description', 'Текст из CMS');
  expect(JSON.parse(childrenBlock.dataset.config)).toEqual({ compact: true });
  expect(sectionOrder(container)).toEqual(['hero', 'children', 'help', 'projects']);
  const firstTone = childrenBlock.parentElement.className;
  const secondTone = screen.getByTestId('help').parentElement.className;
  const thirdTone = screen.getByTestId('projects').parentElement.className;
  expect(firstTone).not.toBe('');
  expect(secondTone).not.toBe(firstTone);
  expect(thirdTone).toBe(firstTone);
});
