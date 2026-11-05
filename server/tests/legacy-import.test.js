import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExtendedImportPlan, buildImportPlan, extractContacts, htmlToStructuredContent, htmlToText, parseMigrationData, parseRows, safeSlug, summarizeExtendedPlan, summarizePlan } from '../scripts/legacy-import/legacy-import.js';
import { indexMediaId, mediaFormat, mediaLookupKeys, resolveMediaIds } from '../scripts/legacy-import/media-import.js';

test('parses escaped Joomla INSERT rows without executing SQL', () => {
  const sql = "INSERT INTO `chdg4_content` (`id`,`title`,`introtext`) VALUES ('1','Дет\\'ям','Строка\\nдва'),('2','Второй',NULL);";
  assert.deepEqual(parseRows(sql, 'chdg4_content'), [
    { id: '1', title: "Дет'ям", introtext: 'Строка\nдва' },
    { id: '2', title: 'Второй', introtext: null },
  ]);
});

test('converts legacy HTML to safe structured paragraphs', () => {
  const html = '<p>Первый &amp; безопасный</p><script>alert(1)</script><p>Второй<br>ряд</p>';
  assert.equal(htmlToText(html), 'Первый & безопасный\nВторой\nряд');
  const document = htmlToStructuredContent(html);
  assert.equal(document.type, 'doc');
  assert.equal(document.content[0].content[0].text, 'Первый & безопасный\nВторой\nряд');
  assert.doesNotMatch(JSON.stringify(document), /script|alert/);
});

test('normalizes Cyrillic and unsafe aliases to deterministic slugs', () => {
  assert.equal(safeSlug('Помощь детям!', 12), 'pomosch-detyam');
  assert.equal(safeSlug('', 12), 'legacy-12');
});

test('builds only high-confidence published non-sensitive records', () => {
  const sql = "INSERT INTO `chdg4_content` (`id`,`alias`,`title`,`introtext`,`fulltext`,`metadesc`,`created`,`modified`) VALUES ('10','news','Новость','Кратко','Полный текст','Описание','2020-01-01 00:00:00','2020-01-02 00:00:00'),('11','child','Ребёнок','Текст','','','2020-01-01 00:00:00','2020-01-02 00:00:00');";
  const migrationData = { distributed: [
    { uid: 'content-10', oldId: '10', target: 'Publication', confidence: 'HIGH', sourceStatusLabel: 'опубликовано', title: 'Новость', theme: 'Новости', reason: 'Предлагаемый kind: NEWS.' },
    { uid: 'content-11', oldId: '11', target: 'ChildProfile', confidence: 'HIGH', sourceStatusLabel: 'опубликовано', title: 'Ребёнок', reason: '' },
    { uid: 'category-1', oldId: '1', target: 'Category', confidence: 'HIGH', sourceStatusLabel: 'сводная запись', title: 'Новости' },
  ] };
  const plan = buildImportPlan({ sql, migrationData });
  assert.equal(plan.publications.length, 1);
  assert.equal(plan.publications[0].kind, 'NEWS');
  assert.equal(plan.categories.length, 1);
  assert.equal(summarizePlan(plan).total, 2);
});

test('parses the generated browser assignment safely', () => {
  assert.deepEqual(parseMigrationData('window.MIGRATION_DATA = {"distributed":[]};'), { distributed: [] });
});

test('extracts non-public contact entries from the old contact page', () => {
  const contacts = extractContacts('Кыргызская Республика\nАдрес 1\nТелефон: +996 312 90-51-78\nСот: (0508)103-103\ne-mail: test@example.com', '120');
  assert.deepEqual(contacts.map(item => item.type), ['ADDRESS', 'PHONE', 'PHONE', 'EMAIL']);
  assert.ok(contacts.every(item => item.isPublic === false));
  assert.equal(contacts[1].href, 'tel:+996312905178');
});

test('indexes equivalent old media paths and deduplicates resolved ids', () => {
  const index = new Map();
  indexMediaId(index, 'media/images/Test Image.JPG', 'media-id');
  assert.deepEqual(mediaLookupKeys('images/Test%20Image.JPG'), ['images/test image.jpg', 'media/images/test image.jpg']);
  assert.deepEqual(resolveMediaIds(index, ['images/Test%20Image.JPG', 'media/images/Test Image.JPG']), ['media-id']);
  assert.deepEqual(mediaFormat('file.pdf'), { kind: 'DOCUMENT', mimeType: 'application/pdf', extension: 'pdf' });
});

test('builds an extended draft plan for children, stories and contacts', () => {
  const sql = [
    "INSERT INTO `chdg4_content` (`id`,`alias`,`title`,`introtext`,`fulltext`,`metadesc`,`created`,`modified`) VALUES ('20','child','Ребёнок','Описание','','','2020-01-01 00:00:00','2020-01-02 00:00:00'),('21','story','История','Текст','','','2020-01-01 00:00:00','2020-01-02 00:00:00'),('22','contacts','Контакты','Адрес\\nТелефон: +996 312 90-51-78','','','2020-01-01 00:00:00','2020-01-02 00:00:00');",
    "INSERT INTO `chdg4_sppagebuilder` (`id`,`text`) VALUES ('1','[]');",
  ].join('\n');
  const migrationData = { distributed: [
    { uid: 'content-20', oldId: '20', target: 'ChildProfile', confidence: 'HIGH', sourceStatusLabel: 'опубликовано', title: 'Ребёнок', mediaPaths: [] },
    { uid: 'content-21', oldId: '21', target: 'Story', confidence: 'MEDIUM', sourceStatusLabel: 'опубликовано', title: 'История', mediaPaths: [] },
    { uid: 'content-22', oldId: '22', target: 'ContactEntry', confidence: 'MEDIUM', sourceStatusLabel: 'опубликовано', title: 'Контакты', mediaPaths: [] },
  ], media: { files: [], missingRefs: [], dangerous: [] }, unassigned: [] };
  const plan = buildExtendedImportPlan({ sql, migrationData });
  assert.equal(plan.children.length, 1);
  assert.equal(plan.children[0].status, 'DRAFT');
  assert.equal(plan.stories.length, 1);
  assert.equal(plan.contacts.length, 2);
  assert.equal(summarizeExtendedPlan(plan).totalContent, 4);
});
