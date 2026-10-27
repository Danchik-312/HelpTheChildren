import * as service from './content.service.js';

export const adminList = resource => async (req, res) => { const result = await service.adminList(resource, req.query); res.json({ data: { items: result.items }, meta: result.meta }); };
export const adminGet = resource => async (req, res) => res.json({ data: await service.adminGet(resource, req.params.id) });
export const create = resource => async (req, res) => res.status(201).json({ data: await service.create(resource, req.body, req.auth.user, req.id) });
export const update = resource => async (req, res) => res.json({ data: await service.update(resource, req.params.id, req.body, req.auth.user, req.id) });
export const publish = (resource, state) => async (req, res) => res.json({ data: await service.setPublication(resource, req.params.id, req.body.version, state, req.auth.user, req.id) });
export const archive = resource => async (req, res) => { await service.archive(resource, req.params.id, req.auth.user, req.id); res.status(204).end(); };
export const restore = resource => async (req, res) => res.json({ data: await service.restore(resource, req.params.id, req.auth.user, req.id) });
export const preview = resource => async (req, res) => { res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Robots-Tag', 'noindex'); res.json({ data: await service.adminGet(resource, req.params.id) }); };
export const publicList = resource => async (req, res) => {
  if (resource === 'children') res.setHeader('Cache-Control', 'private, no-store');
  const result = await service.publicList(resource, req.query);
  res.json({ data: { items: result.items }, meta: result.meta });
};
export const publicGet = resource => async (req, res) => {
  if (resource === 'children') res.setHeader('Cache-Control', 'private, no-store');
  res.json({ data: await service.publicGet(resource, req.params.slug) });
};
export async function publicPageGet(req, res) {
  res.json({ data: await service.publicPageGet(req.params.group, req.params.slug) });
}
