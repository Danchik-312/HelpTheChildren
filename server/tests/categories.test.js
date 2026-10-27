import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
const [{ prisma }, categories, contentService, repository, { categoriesAdminRouter, categoriesPublicRouter }, { errorHandler }] = await Promise.all([
  import('../src/db/prisma.js'),
  import('../src/modules/categories/categories.service.js'),
  import('../src/modules/content/content.service.js'),
  import('../src/modules/content/content.repository.js'),
  import('../src/modules/categories/categories.routes.js'),
  import('../src/middleware/error-handler.js'),
]);

function stub(t, target, name, implementation) {
  const original = target[name];
  target[name] = implementation;
  t.after(() => { target[name] = original; });
}

test('category public list is scoped to requested kind and published publications', async t => {
  let args;
  stub(t, prisma.category, 'findMany', async input => { args = input; return [{ id: 'cat-1', slug: 'news', name: 'Новости' }]; });
  const result = await categories.publicList('ARTICLE');
  assert.deepEqual(result.items, [{ id: 'cat-1', slug: 'news', name: 'Новости' }]);
  assert.equal(args.where.publications.some.publication.kind, 'ARTICLE');
  assert.equal(args.where.publications.some.publication.status, 'PUBLISHED');
  assert.equal(args.where.publications.some.publication.deletedAt, null);
  assert.ok(args.where.publications.some.publication.publishedAt.lte instanceof Date);
});

test('publication list query combines publication kind and category filter', () => {
  const where = repository.adminWhere('publications', { kind: 'NEWS', categoryId: 'category-id' });
  assert.ok(where.AND.some(clause => clause.kind === 'NEWS'));
  assert.ok(where.AND.some(clause => clause.categories?.some?.categoryId === 'category-id'));
});

test('public publication list applies category filter in addition to public visibility', async t => {
  let findArgs;
  let countArgs;
  stub(t, prisma.publication, 'findMany', async args => { findArgs = args; return []; });
  stub(t, prisma.publication, 'count', async args => { countArgs = args; return 0; });
  stub(t, prisma, '$transaction', async queries => Promise.all(queries));
  await contentService.publicList('publications', { kind: 'NEWS', categoryId: 'category-id' });
  for (const where of [findArgs.where, countArgs.where]) {
    assert.equal(where.kind, 'NEWS');
    assert.equal(where.status, 'PUBLISHED');
    assert.equal(where.deletedAt, null);
    assert.equal(where.categories.some.categoryId, 'category-id');
  }
});

test('removing an in-use category returns CATEGORY_IN_USE and never deletes it', async t => {
  let deleteCalled = false;
  const tx = {
    $queryRaw: async (_strings, id) => [{ id }],
    publicationCategory: { count: async () => 1 },
    category: { delete: async () => { deleteCalled = true; } },
  };
  stub(t, prisma, '$transaction', async callback => callback(tx));
  await assert.rejects(categories.remove('category-id'), error => error.status === 409 && error.code === 'CATEGORY_IN_USE');
  assert.equal(deleteCalled, false);
});

test('category HTTP API filters public categories and enforces ADMIN writes', async t => {
  let categoryWhere;
  let deleteCalled = false;
  let role = 'ADMIN';
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.id = 'category-test'; req.auth = { user: { id: 'admin-id', role, permissions: [] } }; next(); });
  app.use('/admin/categories', categoriesAdminRouter);
  app.use('/public/categories', categoriesPublicRouter);
  app.use(errorHandler);

  stub(t, prisma.category, 'findMany', async args => {
    categoryWhere = args.where;
    return [{ id: 'category-id', slug: 'articles', name: 'Статьи' }];
  });
  stub(t, prisma.category, 'create', async ({ data }) => ({ id: 'created-id', ...data }));
  const tx = {
    $queryRaw: async (_strings, id) => [{ id }],
    publicationCategory: { count: async () => 1 },
    category: { delete: async () => { deleteCalled = true; } },
  };
  stub(t, prisma, '$transaction', async callback => callback(tx));

  const publicList = await request(app).get('/public/categories?kind=ARTICLE').expect(200);
  assert.deepEqual(publicList.body.data.items, [{ id: 'category-id', slug: 'articles', name: 'Статьи' }]);
  assert.equal(categoryWhere.publications.some.publication.kind, 'ARTICLE');

  const created = await request(app).post('/admin/categories').send({ name: 'Новая', slug: 'new-category' }).expect(201);
  assert.deepEqual(created.body.data, { id: 'created-id', name: 'Новая', slug: 'new-category' });
  await request(app).delete('/admin/categories/123e4567-e89b-42d3-a456-426614174000').expect(409)
    .expect(response => assert.equal(response.body.error.code, 'CATEGORY_IN_USE'));
  assert.equal(deleteCalled, false);

  role = 'EDITOR';
  await request(app).post('/admin/categories').send({ name: 'Запрещённая', slug: 'forbidden' }).expect(403);
});
