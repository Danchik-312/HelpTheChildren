import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import HomePage from './HomePage';

jest.mock('../../components/Hero/Hero', () => () => <div data-testid="hero" />);
jest.mock('../../components/ChildrenSection/ChildrenSection', () => props => <div data-testid="children">{props.heading}</div>);
jest.mock('../../components/HelpSection/HelpSection', () => props => <div data-testid="help">{props.heading}</div>);
jest.mock('../../components/ProjectsSection/ProjectsSection', () => props => <div data-testid="projects">{props.heading}</div>);
jest.mock('../../components/NewsSection/NewsSection', () => props => <div data-testid="publications">{props.heading}</div>);
jest.mock('../../components/FriendsSection/FriendsSection', () => props => <div data-testid="friends">{props.heading}</div>);

const sectionOrder = container => [...container.querySelectorAll('[data-testid]')].map(node => node.dataset.testid);
const respondWith = items => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items } }) });
};

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
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
