import { pagesApi, projectsApi } from './contentApi';

const response = data => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({ data }),
});

afterEach(() => jest.restoreAllMocks());

test('передаёт фильтры проектов в реальный REST endpoint', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ items: [] }));
  await projectsApi.list({ q: 'лето', status: 'DRAFT', kind: 'PROGRAM', page: 2, pageSize: 20 });
  expect(global.fetch.mock.calls[0][0]).toContain('/admin/projects?q=%D0%BB%D0%B5%D1%82%D0%BE&status=DRAFT&kind=PROGRAM&page=2&pageSize=20');
});

test('использует group для списка информационных страниц', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ items: [] }));
  await pagesApi.list({ group: 'ABOUT', page: 1 });
  expect(global.fetch.mock.calls[0][0]).toContain('/admin/pages?group=ABOUT&page=1');
});
