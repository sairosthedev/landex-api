import { AuditLog, User } from '../models/index.js';
import { pageResponse } from '../utils/apiResponse.js';

export function auditContextFromReq(req) {
  return {
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
    userAgent: req.headers['user-agent'],
    requestMethod: req.method,
    requestPath: req.originalUrl || req.path,
  };
}

export async function recordAudit(ctx, payload) {
  let actorEmail = ctx.actorEmail;
  if (!actorEmail && ctx.actorId) {
    const actor = await User.findById(ctx.actorId).select('email');
    actorEmail = actor?.email;
  }

  await AuditLog.create({
    actorId: ctx.actorId,
    actorEmail,
    action: payload.action,
    entitySchema: payload.entitySchema,
    entityTable: payload.entityTable ?? payload.entitySchema,
    entityId: payload.entityId,
    entityReference: payload.entityReference,
    beforeState: payload.beforeState,
    afterState: payload.afterState,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    requestMethod: ctx.requestMethod,
    requestPath: ctx.requestPath,
    occurredAt: new Date(),
  });
}

export function toAuditLogResponse(doc) {
  const occurredAt = doc.occurredAt ?? doc.createdAt;
  const iso = occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt;
  const email = doc.actorEmail ?? '';
  const actorName = email.includes('@') ? email.split('@')[0] : (email || 'System');

  return {
    id: doc._id?.toString?.() ?? doc.id,
    action: doc.action,
    actorId: doc.actorId?.toString?.(),
    actorEmail: email,
    actorName,
    entitySchema: doc.entitySchema ?? doc.entityTable,
    entityReference: doc.entityReference,
    entityId: doc.entityId?.toString?.(),
    details: payloadDetails(doc),
    metadata: doc.beforeState || doc.afterState
      ? { before: doc.beforeState, after: doc.afterState }
      : undefined,
    ipAddress: doc.ipAddress,
    createdAt: iso,
    timestamp: iso,
  };
}

function payloadDetails(doc) {
  if (doc.entityReference) return doc.entityReference;
  if (doc.afterState && typeof doc.afterState === 'object') {
    try {
      return JSON.stringify(doc.afterState);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function searchAuditLogs(pagination, filters = {}) {
  const { page, size, skip } = pagination;
  const query = {};
  if (filters.actorId) query.actorId = filters.actorId;
  if (filters.action) query.action = filters.action;
  if (filters.entitySchema) query.entitySchema = filters.entitySchema;
  if (filters.entityTable) query.entityTable = filters.entityTable;

  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ occurredAt: -1 }).skip(skip).limit(size),
    AuditLog.countDocuments(query),
  ]);

  return pageResponse(items.map(toAuditLogResponse), page, size, total);
}
