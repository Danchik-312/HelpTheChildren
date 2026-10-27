import * as service from './users.service.js';

export async function list(req, res) { const result = await service.list(req.query); res.json({ data: { items: result.items }, meta: result.meta }); }
export async function create(req, res) { res.status(201).json({ data: await service.create(req.body, req.auth.user, req.id) }); }
export async function update(req, res) { res.json({ data: await service.update(req.params.id, req.body, req.auth.user, req.id) }); }
export async function activate(req, res) { await service.setStatus(req.params.id, 'ACTIVE', req.auth.user, req.id); res.status(204).end(); }
export async function deactivate(req, res) { await service.setStatus(req.params.id, 'DISABLED', req.auth.user, req.id); res.status(204).end(); }
