import { IntegrationCredentialService } from '../../services/integrationCredential.service'
import prisma from '../../lib/prisma'
import { IntegrationCredentialStatus } from '../../generated/prisma/client'
import { strict as assert } from 'assert'

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    integrationCredential: {
      findMany: jest.fn(),
    },
  },
}))

describe('IntegrationCredentialService.detectRevokedOnlyProviders', () => {
  const mockedPrisma = prisma as unknown as {
    integrationCredential: { findMany: jest.Mock }
  }

  beforeEach(() => {
    mockedPrisma.integrationCredential.findMany.mockReset()
  })

  it('returns empty when no providers given', async () => {
    const out = await IntegrationCredentialService.detectRevokedOnlyProviders('user-1', [])
    assert.deepEqual(out, [])
    // ensure prisma not called
    assert.equal((mockedPrisma.integrationCredential.findMany as any).mock.calls.length, 0)
  })

  it('flags provider when latest credential is revoked and no ACTIVE exists', async () => {
    mockedPrisma.integrationCredential.findMany.mockResolvedValue([
      {
        id: 'c1',
        provider: 'openai',
        label: 'Old Active',
        encryptedSecret: 'enc-1',
        secretFingerprint: 'fp-1',
        status: IntegrationCredentialStatus.REVOKED,
        metadata: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        lastRotatedAt: new Date('2024-01-01T00:00:00Z'),
        revokedAt: new Date('2024-02-01T00:00:00Z'),
        ownerId: 'user-1',
        createdBy: 'user-1',
      },
    ])

    const out = await IntegrationCredentialService.detectRevokedOnlyProviders('user-1', ['openai'])
    assert.deepEqual(out, ['openai'])
  })

  it('does not flag provider when an ACTIVE credential exists', async () => {
    mockedPrisma.integrationCredential.findMany.mockResolvedValue([
      {
        id: 'c1',
        provider: 'anthropic',
        label: 'Active',
        encryptedSecret: 'enc-1',
        secretFingerprint: 'fp-1',
        status: IntegrationCredentialStatus.ACTIVE,
        metadata: null,
        createdAt: new Date('2024-03-01T00:00:00Z'),
        updatedAt: new Date('2024-03-01T00:00:00Z'),
        lastRotatedAt: new Date('2024-03-01T00:00:00Z'),
        revokedAt: null,
        ownerId: 'user-1',
        createdBy: 'user-1',
      },
      {
        id: 'c0',
        provider: 'anthropic',
        label: 'Older Revoked',
        encryptedSecret: 'enc-0',
        secretFingerprint: 'fp-0',
        status: IntegrationCredentialStatus.REVOKED,
        metadata: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        lastRotatedAt: new Date('2024-01-01T00:00:00Z'),
        revokedAt: new Date('2024-02-01T00:00:00Z'),
        ownerId: 'user-1',
        createdBy: 'user-1',
      },
    ])

    const out = await IntegrationCredentialService.detectRevokedOnlyProviders('user-1', ['anthropic'])
    assert.deepEqual(out, [])
  })
})
