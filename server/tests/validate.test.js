import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.js';

test('query validation works with the Express 5 getter and preserves coercion', async () => {
  const app = express();
  const schema = z.object({ page: z.coerce.number().int().positive() }).strict();
  app.get('/items', validate(schema, 'query'), (req, res) => res.json({ page: req.query.page, type: typeof req.query.page }));

  const response = await request(app).get('/items?page=2').expect(200);
  assert.deepEqual(response.body, { page: 2, type: 'number' });
});
