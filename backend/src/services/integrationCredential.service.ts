import type { Prisma } from '../generated/prisma/client';
import { IntegrationCredentialStatus } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import { KeyVaultService } from '../lib/keyVault';
import { AuditService } from './audit.service';
import { providerRegistry } from '../config/providers';

export interface CredentialResponse {
  id: string;
  provider: string;
  label: string;
  status: IntegrationCredentialStatus;
  metadata?: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  lastRotatedAt?: Date | null;
  revokedAt?: Date | null;
}

function assertProviderExists(provider: string) {
  if (!providerRegistry[provider]) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

function sanitiseLabel(label: string): string {
  return label.trim();
}

function sanitiseProvider(provider: string): string {
  return provider.toLowerCase().trim();
}

export class IntegrationCredentialService {
  private static toResponse(record: Awaited<ReturnType<typeof prisma.integrationCredential.findUniqueOrThrow>>): CredentialResponse {
    return {
      id: record.id,
      provider: record.provider,
      label: record.label,
      status: record.status,
      metadata: record.metadata ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastRotatedAt: record.lastRotatedAt,
      revokedAt: record.revokedAt,
    };
  }

  static async list(ownerId: string): Promise<CredentialResponse[]> {
    const credentials = await prisma.integrationCredential.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map((credential) => this.toResponse(credential));
  }

  static async create(input: {
    ownerId: string;
    actorId: string;
    provider: string;
    label: string;
    secret: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<CredentialResponse> {
    const provider = sanitiseProvider(input.provider);
    const label = sanitiseLabel(input.label);

    if (!label) {
      throw new Error('Label is required');
    }
    if (!input.secret || input.secret.trim().length === 0) {
      throw new Error('Secret is required');
    }

    assertProviderExists(provider);

    const encryptedSecret = KeyVaultService.encryptSecret(input.secret);
    const fingerprint = KeyVaultService.fingerprint(input.secret);

    const created = await prisma.integrationCredential.create({
      data: {
        provider,
        label,
        encryptedSecret,
        secretFingerprint: fingerprint,
        metadata: input.metadata ?? undefined,
        ownerId: input.ownerId,
        createdBy: input.actorId,
        lastRotatedAt: new Date(),
        status: IntegrationCredentialStatus.ACTIVE,
      },
    });

    await AuditService.record({
      actorId: input.actorId,
      action: 'integration.credential.created',
      targetType: 'integrationCredential',
      targetId: created.id,
      metadata: {
        provider,
        label,
        fingerprint,
      },
    });

    return this.toResponse(created);
  }

  static async rotate(input: {
    credentialId: string;
    ownerId: string;
    actorId: string;
    secret: string;
    metadata?: Prisma.InputJsonValue;
    label?: string;
  }): Promise<CredentialResponse> {
    if (!input.secret || input.secret.trim().length === 0) {
      throw new Error('Secret is required');
    }

    const credential = await prisma.integrationCredential.findFirstOrThrow({
      where: {
        id: input.credentialId,
        ownerId: input.ownerId,
      },
    });

    const encryptedSecret = KeyVaultService.encryptSecret(input.secret);
    const fingerprint = KeyVaultService.fingerprint(input.secret);

    const updated = await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: {
        encryptedSecret,
        secretFingerprint: fingerprint,
        metadata: typeof input.metadata !== 'undefined' ? input.metadata : credential.metadata,
        label: input.label ? sanitiseLabel(input.label) : credential.label,
        lastRotatedAt: new Date(),
        status: IntegrationCredentialStatus.ACTIVE,
        revokedAt: null,
      },
    });

    await AuditService.record({
      actorId: input.actorId,
      action: 'integration.credential.rotated',
      targetType: 'integrationCredential',
      targetId: credential.id,
      metadata: {
        provider: credential.provider,
        label: updated.label,
        fingerprint,
      },
    });

    return this.toResponse(updated);
  }

  static async updateMetadata(input: {
    credentialId: string;
    ownerId: string;
    actorId: string;
    label?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<CredentialResponse> {
    const credential = await prisma.integrationCredential.findFirstOrThrow({
      where: { id: input.credentialId, ownerId: input.ownerId },
    });

    const updated = await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: {
        metadata: typeof input.metadata !== 'undefined' ? input.metadata : credential.metadata,
        label: input.label ? sanitiseLabel(input.label) : credential.label,
      },
    });

    await AuditService.record({
      actorId: input.actorId,
      action: 'integration.credential.updated',
      targetType: 'integrationCredential',
      targetId: credential.id,
      metadata: {
        provider: credential.provider,
        label: updated.label,
      },
    });

    return this.toResponse(updated);
  }

  static async revoke(input: {
    credentialId: string;
    ownerId: string;
    actorId: string;
  }): Promise<CredentialResponse> {
    const credential = await prisma.integrationCredential.findFirstOrThrow({
      where: { id: input.credentialId, ownerId: input.ownerId },
    });

    if (credential.status === IntegrationCredentialStatus.REVOKED) {
      return this.toResponse(credential);
    }

    const updated = await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: {
        status: IntegrationCredentialStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await AuditService.record({
      actorId: input.actorId,
      action: 'integration.credential.revoked',
      targetType: 'integrationCredential',
      targetId: credential.id,
      metadata: {
        provider: credential.provider,
        label: credential.label,
      },
    });

    return this.toResponse(updated);
  }
}
