import * as service from './categories.service.js';

export const adminList = async (req, res) => res.json({ data: await service.adminList(req.query) });
export const create = async (req, res) => res.status(201).json({ data: await service.create(req.body) });
export const update = async (req, res) => res.json({ data: await service.update(req.params.id, req.body) });
export const remove = async (req, res) => { await service.remove(req.params.id); res.status(204).end(); };
export const publicList = async (req, res) => {
  const kind = ['NEWS', 'ARTICLE'].includes(req.query.kind) ? req.query.kind : 'NEWS';
  res.json({ data: await service.publicList(kind) });
};
