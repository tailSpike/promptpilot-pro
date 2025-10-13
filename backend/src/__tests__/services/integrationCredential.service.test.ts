import { Prisma } from '../../generated/prisma/client';
import prisma from '../../lib/prisma';
import { IntegrationCredentialService } from '../../services/integrationCredential.service';

const originalEnv = { ...process.env };

describe('IntegrationCredentialService', () => {
  let ownerId: string;
  let actorId: string;

  beforeAll(() => {
    process.env.KMS_MASTER_KEY = 'unit-master-key';
  });

  beforeEach(async () => {
    const timestamp = Date.now();
    const owner = await prisma.user.create({
      data: {
        email: `owner-${timestamp}@example.com`,
        password: 'hashed-password',
        name: 'Owner User',
      },
    });
    ownerId = owner.id;

    const actor = await prisma.user.create({
      data: {
        email: `actor-${timestamp}@example.com`,
        password: 'hashed-password',
        name: 'Actor User',
      },
    });
    actorId = actor.id;
  });

  afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId } });
    await prisma.integrationCredential.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, actorId] } } });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates credentials, encrypts secrets, and resolves active credentials', async () => {
    const created = await IntegrationCredentialService.create({
      ownerId,
      actorId,
      provider: 'OpenAI',
      label: '  Primary Key  ',
      secret: 'sk-test-openai',
      metadata: { region: 'us-east-1' },
    });

    expect(created.provider).toBe('openai');
    expect(created.label).toBe('Primary Key');
    expect(created.status).toBe('ACTIVE');
    expect(created.lastRotatedAt).toBeInstanceOf(Date);

    const record = await prisma.integrationCredential.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.encryptedSecret).not.toBe('sk-test-openai');
    expect(record.secretFingerprint).toHaveLength(64);

    const resolved = await IntegrationCredentialService.resolveActiveCredentials(ownerId, ['openai']);
    expect(resolved.openai?.secret).toBe('sk-test-openai');
    expect(resolved.openai?.metadata).toMatchObject({ region: 'us-east-1' });

    const auditLogs = await prisma.auditLog.findMany({ where: { targetId: created.id } });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({ action: 'integration.credential.created' });
  });

  it('rotates credential secrets and updates metadata correctly', async () => {
    const created = await IntegrationCredentialService.create({
      ownerId,
      actorId,
      provider: 'openai',
      label: 'Secondary Key',
      secret: 'sk-initial',
      metadata: { region: 'us-west-1' },
    });

    const rotated = await IntegrationCredentialService.rotate({
      credentialId: created.id,
      ownerId,
      actorId,
      secret: 'sk-rotated',
      metadata: { region: 'eu-central-1' },
      label: 'Rotated Key',
    });

    expect(rotated.label).toBe('Rotated Key');
    expect(rotated.status).toBe('ACTIVE');
    expect(rotated.metadata).toMatchObject({ region: 'eu-central-1' });

    const resolved = await IntegrationCredentialService.resolveActiveCredential(ownerId, 'openai');
    expect(resolved?.secret).toBe('sk-rotated');
    expect(resolved?.label).toBe('Rotated Key');
    expect(resolved?.metadata).toMatchObject({ region: 'eu-central-1' });

    const auditLogs = await prisma.auditLog.findMany({ where: { targetId: created.id }, orderBy: { createdAt: 'asc' } });
    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[1]).toMatchObject({ action: 'integration.credential.rotated' });
  });

  it('updates metadata and revokes credentials', async () => {
    const created = await IntegrationCredentialService.create({
      ownerId,
      actorId,
      provider: 'anthropic',
      label: 'Anthropic Key',
      secret: 'ant-secret',
      metadata: { org: 'initial' },
    });

    const updated = await IntegrationCredentialService.updateMetadata({
      credentialId: created.id,
      ownerId,
      actorId,
      label: 'Updated Label',
  metadata: null as unknown as Prisma.InputJsonValue,
    });

    expect(updated.label).toBe('Updated Label');
    expect(updated.metadata).toBeUndefined();

    const revoked = await IntegrationCredentialService.revoke({
      credentialId: created.id,
      ownerId,
      actorId,
    });

    expect(revoked.status).toBe('REVOKED');
    expect(revoked.revokedAt).toBeInstanceOf(Date);

    const resolved = await IntegrationCredentialService.resolveActiveCredential(ownerId, 'anthropic');
    expect(resolved).toBeNull();

    const auditLogs = await prisma.auditLog.findMany({ where: { targetId: created.id }, orderBy: { createdAt: 'asc' } });
    expect(auditLogs.map((log) => log.action)).toEqual([
      'integration.credential.created',
      'integration.credential.updated',
      'integration.credential.revoked',
    ]);
  });
});
