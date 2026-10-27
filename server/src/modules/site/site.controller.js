import * as service from './site.service.js';
export async function adminGet(_req, res) { res.json({ data: await service.adminGet() }); }
export async function organization(req, res) { res.json({ data: await service.updateOrganization(req.body, req.auth.user, req.id) }); }
export async function createContact(req, res) { res.status(201).json({ data: await service.createContact(req.body, req.auth.user, req.id) }); }
export async function updateContact(req, res) { res.json({ data: await service.updateContact(req.params.id, req.body, req.auth.user, req.id) }); }
export async function deleteContact(req, res) { await service.deleteContact(req.params.id, req.auth.user, req.id); res.status(204).end(); }
export async function block(req, res) { res.json({ data: await service.upsertBlock(req.body, req.auth.user, req.id) }); }
export async function publicGet(_req, res) { res.json({ data: await service.publicGet() }); }
