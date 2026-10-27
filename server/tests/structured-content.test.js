import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/middleware/error-handler.js';
import { validate } from '../src/middleware/validate.js';
import { schemas } from '../src/modules/content/content.validation.js';

const validBase = {
  kind: 'ARTICLE',
  slug: 'safe-article',
  title: 'Безопасная статья',
  excerpt: 'Краткое описание',
};

function validationApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.id = 'structured-content-test'; next(); });
  app.post('/publication', validate(schemas.publications), (req, res) => res.json({ data: req.body }));
  app.use(errorHandler);
  return app;
}

const app = validationApp();

test('accepts valid Tiptap JSON with safe formatting, links and media references', async () => {
  const mediaId = '123e4567-e89b-42d3-a456-426614174000';
  const body = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Заголовок', marks: [{ type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Подробнее', marks: [{ type: 'link', attrs: { href: '/projects/help', target: null, rel: null, class: null } }] }] },
      { type: 'image', attrs: { mediaId, alt: 'Описание', title: null } },
      { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Пункт', marks: [{ type: 'italic' }] }] }] }] },
    ],
  };
  const response = await request(app).post('/publication').send({ ...validBase, body }).expect(200);
  assert.deepEqual(response.body.data.body, body);
});

test('keeps safe compatibility with legacy paragraph fixtures', async () => {
  await request(app).post('/publication').send({ ...validBase, body: [] }).expect(200);
  await request(app).post('/publication').send({ ...validBase, body: [{ type: 'paragraph', text: 'Старый безопасный текст' }] }).expect(200);
});

test('the same structured body validation protects stories and pages', () => {
  const unsafeBody = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'XSS', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] };
  const story = schemas.stories.safeParse({ slug: 'story', title: 'История', excerpt: 'Описание', body: unsafeBody });
  const page = schemas.pages.safeParse({ slug: 'page', title: 'Страница', group: 'GENERAL', description: 'Описание', body: unsafeBody });
  assert.equal(story.success, false);
  assert.equal(page.success, false);
  assert.deepEqual(story.error.issues[0].path, ['body', 'content', 0, 'content', 0, 'marks', 0, 'attrs', 'href']);
  assert.deepEqual(page.error.issues[0].path, ['body', 'content', 0, 'content', 0, 'marks', 0, 'attrs', 'href']);
});

for (const [name, body, expectedField] of [
  ['rejects HTML nodes', { type: 'doc', content: [{ type: 'html', attrs: { html: '<script>alert(1)</script>' } }] }, 'body.content.0.type'],
  ['rejects javascript links', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'XSS', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }, 'body.content.0.content.0.marks.0.attrs.href'],
  ['rejects data links', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'XSS', marks: [{ type: 'link', attrs: { href: 'data:text/html;base64,PHNjcmlwdD4=' } }] }] }] }, 'body.content.0.content.0.marks.0.attrs.href'],
  ['rejects unknown attributes', { type: 'doc', content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' }, content: [{ type: 'text', text: 'Текст' }] }] }, 'body.content.0.attrs'],
  ['rejects arbitrary image src attributes', { type: 'doc', content: [{ type: 'image', attrs: { mediaId: '123e4567-e89b-42d3-a456-426614174000', src: 'https://attacker.example/pixel.png' } }] }, 'body.content.0.attrs.src'],
  ['rejects image without a media ID', { type: 'doc', content: [{ type: 'image', attrs: { alt: 'Изображение' } }] }, 'body.content.0.attrs.mediaId'],
]) {
  test(name, async () => {
    const response = await request(app).post('/publication').send({ ...validBase, body }).expect(400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    assert.ok(response.body.error.fields[expectedField], JSON.stringify(response.body.error.fields));
  });
}
