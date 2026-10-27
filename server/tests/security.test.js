import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/lib/crypto.js';
import { hasPermission } from '../src/config/permissions.js';

test('scrypt password hashes verify without storing plaintext', async () => {
  const password = 'correct horse battery staple';
  const hash = await hashPassword(password);
  assert.match(hash, /^scrypt\$/);
  assert.equal(hash.includes(password), false);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong password value', hash), false);
});

test('ADMIN bypasses area scopes and EDITOR is limited by permissions', () => {
  assert.equal(hasPermission({ role: 'ADMIN', permissions: [] }, 'SITE', 'publish'), true);
  const editor = { role: 'EDITOR', permissions: [{ area: 'PUBLICATIONS', canPublish: false }] };
  assert.equal(hasPermission(editor, 'PUBLICATIONS', 'write'), true);
  assert.equal(hasPermission(editor, 'PUBLICATIONS', 'publish'), false);
  assert.equal(hasPermission(editor, 'SITE', 'read'), false);
});
