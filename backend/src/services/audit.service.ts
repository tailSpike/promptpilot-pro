import type { Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';

export interface AuditLogInput {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}

export class AuditService {
  static async record(log: AuditLogInput) {
    return prisma.auditLog.create({
      data: {
        actorId: log.actorId,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        ...(log.metadata !== undefined ? { metadata: log.metadata } : {}),
      },
    });
  }
}
