import prisma from '../../lib/prisma';
import { AuditService } from '../../services/audit.service';

describe('AuditService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records log entries with metadata when provided', async () => {
    const createSpy = jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'log-1' } as any);

    await AuditService.record({
      actorId: 'user-1',
      action: 'CREATE',
      targetType: 'workflow',
      targetId: 'wf-1',
      metadata: { field: 'value' },
    });

    expect(createSpy).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'CREATE',
        targetType: 'workflow',
        targetId: 'wf-1',
        metadata: { field: 'value' },
      },
    });
  });

  it('omits metadata when not provided', async () => {
    const createSpy = jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'log-2' } as any);

    await AuditService.record({
      actorId: 'user-2',
      action: 'DELETE',
      targetType: 'workflow',
      targetId: 'wf-2',
    });

    expect(createSpy).toHaveBeenCalledWith({
      data: {
        actorId: 'user-2',
        action: 'DELETE',
        targetType: 'workflow',
        targetId: 'wf-2',
      },
    });
  });
});
