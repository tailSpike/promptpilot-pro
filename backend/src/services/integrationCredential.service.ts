import { Prisma, IntegrationCredentialStatus } from '../generated/prisma/client';
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

function normaliseMetadata(
  value: Prisma.InputJsonValue | Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function toMetadataRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  if ((value as unknown) === Prisma.JsonNull) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { value };
}

export interface ResolvedIntegrationCredential {
  id: string;
  provider: string;
  label: string;
  secret: string;
  metadata: Record<string, unknown> | null;
  lastRotatedAt?: Date | null;
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

  return credentials.map((credential: any) => this.toResponse(credential));
  }

  static async resolveActiveCredentials(
    ownerId: string,
    providers: string[],
  ): Promise<Record<string, ResolvedIntegrationCredential>> {
    const uniqueProviders = Array.from(new Set(providers.filter(Boolean)));
    if (uniqueProviders.length === 0) {
      return {};
    }

    const records = await prisma.integrationCredential.findMany({
      where: {
        ownerId,
        provider: { in: uniqueProviders },
        status: IntegrationCredentialStatus.ACTIVE,
      },
      orderBy: [
        { lastRotatedAt: 'desc' },
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const resolved: Record<string, ResolvedIntegrationCredential> = {};
    for (const record of records) {
      if (resolved[record.provider]) {
        continue;
      }

      resolved[record.provider] = {
        id: record.id,
        provider: record.provider,
        label: record.label,
        secret: KeyVaultService.decryptSecret(record.encryptedSecret),
        metadata: toMetadataRecord(record.metadata),
        lastRotatedAt: record.lastRotatedAt,
      };
    }

    return resolved;
  }

  /**
   * Returns the subset of provider IDs for which the latest credential is revoked
   * and there is no ACTIVE credential available. Used to block preview runs with
   * an explicit error instead of silently falling back.
   */
  static async detectRevokedOnlyProviders(
    ownerId: string,
    providers: string[],
  ): Promise<string[]> {
    const uniqueProviders = Array.from(new Set(providers.filter(Boolean)))
    if (uniqueProviders.length === 0) return []

    // Fetch latest credential per provider (by lastRotatedAt/updatedAt/createdAt)
    const records = await prisma.integrationCredential.findMany({
      where: { ownerId, provider: { in: uniqueProviders } },
      orderBy: [
        { lastRotatedAt: 'desc' },
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    const latestByProvider = new Map<string, typeof records[number]>()
    for (const rec of records) {
      if (!latestByProvider.has(rec.provider)) {
        latestByProvider.set(rec.provider, rec)
      }
    }

    const revokedOnly: string[] = []
    for (const provider of uniqueProviders) {
      const latest = latestByProvider.get(provider)
      if (!latest) continue
      if (latest.status === IntegrationCredentialStatus.REVOKED) {
        // Ensure there is no ACTIVE credential for this provider
  const active = records.find((r: any) => r.provider === provider && r.status === IntegrationCredentialStatus.ACTIVE)
        if (!active) revokedOnly.push(provider)
      }
    }

    return revokedOnly
  }

  static async resolveActiveCredential(
    ownerId: string,
    provider: string,
  ): Promise<ResolvedIntegrationCredential | null> {
    const resolved = await this.resolveActiveCredentials(ownerId, [provider]);
    return resolved[provider] ?? null;
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
        metadata: normaliseMetadata(
          typeof input.metadata !== 'undefined' ? input.metadata : credential.metadata,
        ),
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
        metadata: normaliseMetadata(
          typeof input.metadata !== 'undefined' ? input.metadata : credential.metadata,
        ),
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
