export function writeAudit(tx, { actorId, action, entityType, entityId, summary, requestId }) {
  return tx.auditLog.create({ data: { actorId, action, entityType, entityId, summary, requestId } });
}
