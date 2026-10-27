import * as service from './hero.service.js';
export async function list(_req, res) { res.json({ data: { items: await service.list() } }); }
export async function create(req, res) { res.status(201).json({ data: await service.create(req.body, req.auth.user, req.id) }); }
export async function update(req, res) { res.json({ data: await service.update(req.params.id, req.body, req.auth.user, req.id) }); }
export const publish = state => async (req, res) => res.json({ data: await service.publish(req.params.id, req.body.version, state, req.auth.user, req.id) });
export async function reorder(req, res) { await service.reorder(req.body.items, req.auth.user, req.id); res.status(204).end(); }
export async function archive(req, res) { await service.archive(req.params.id, req.auth.user, req.id); res.status(204).end(); }
export async function publicList(_req, res) { res.json({ data: { items: await service.publicList() } }); }
