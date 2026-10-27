import test from 'node:test';
import assert from 'node:assert/strict';
import { deepmerge } from 'deepmerge-ts';

test('deepmerge-ts override handles nested Prisma-style config objects', () => {
  const merged = deepmerge(
    { schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations', seed: { enabled: false } } },
    { migrations: { seed: { enabled: true } } },
  );
  assert.equal(merged.schema, 'prisma/schema.prisma');
  assert.equal(merged.migrations.path, 'prisma/migrations');
  assert.equal(merged.migrations.seed.enabled, true);
});

test('deepmerge-ts override does not exhaust the stack on cyclic graphs', () => {
  const left = { name: 'left' };
  const right = { name: 'right' };
  left.self = left;
  right.self = right;
  assert.doesNotThrow(() => deepmerge(left, right));
});
