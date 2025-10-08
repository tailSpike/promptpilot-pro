import { workflowService } from '../../services/workflowService';
import { IntegrationCredentialService } from '../../services/integrationCredential.service';
import type { ResolvedIntegrationCredential } from '../../services/integrationCredential.service';

describe('WorkflowService credential loading', () => {
  const loadCredentials = async (
    ownerId: string,
    providers: string[],
    cache: Map<string, ResolvedIntegrationCredential | null>,
  ) => (workflowService as any).loadProviderCredentials(ownerId, providers, cache);

  const buildCredential = (overrides: Partial<ResolvedIntegrationCredential> = {}): ResolvedIntegrationCredential => ({
    id: overrides.id ?? 'cred-openai',
    provider: overrides.provider ?? 'openai',
    label: overrides.label ?? 'Primary',
    secret: overrides.secret ?? 'sk-test-123',
    metadata: overrides.metadata ?? { region: 'us-east-1' },
    lastRotatedAt: overrides.lastRotatedAt ?? new Date('2024-01-01T00:00:00Z'),
  });

  it('caches resolved provider credentials to avoid duplicate lookups', async () => {
    const resolveSpy = jest.spyOn(IntegrationCredentialService, 'resolveActiveCredentials');
    const cache = new Map<string, ResolvedIntegrationCredential | null>();
    const credential = buildCredential();
    resolveSpy.mockResolvedValueOnce({ openai: credential });

    const firstResult = await loadCredentials('user-1', ['openai'], cache);

    expect(firstResult).toEqual({ openai: credential });
    expect(cache.get('openai')).toBe(credential);
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    resolveSpy.mockClear();
    resolveSpy.mockResolvedValueOnce({ openai: buildCredential({ label: 'Secondary' }) });

    const secondResult = await loadCredentials('user-1', ['openai'], cache);

    expect(secondResult).toEqual({ openai: credential });
    expect(resolveSpy).not.toHaveBeenCalled();
    resolveSpy.mockRestore();
  });

  it('stores null entries for missing credentials and skips re-fetching', async () => {
    const resolveSpy = jest.spyOn(IntegrationCredentialService, 'resolveActiveCredentials');
    const cache = new Map<string, ResolvedIntegrationCredential | null>();
    resolveSpy.mockResolvedValueOnce({});

    const firstResult = await loadCredentials('user-2', ['anthropic'], cache);

    expect(firstResult).toEqual({});
    expect(cache.has('anthropic')).toBe(true);
    expect(cache.get('anthropic')).toBeNull();
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    resolveSpy.mockClear();
    resolveSpy.mockResolvedValueOnce({ anthropic: buildCredential({ provider: 'anthropic', secret: 'ant-secret' }) });

    const secondResult = await loadCredentials('user-2', ['anthropic'], cache);

    expect(secondResult).toEqual({});
    expect(resolveSpy).not.toHaveBeenCalled();
    resolveSpy.mockRestore();
  });

  it('only fetches credentials for providers not already cached', async () => {
    const resolveSpy = jest.spyOn(IntegrationCredentialService, 'resolveActiveCredentials');
    const cache = new Map<string, ResolvedIntegrationCredential | null>();
    const openaiCred = buildCredential();
    cache.set('openai', openaiCred);

    resolveSpy.mockResolvedValueOnce({ anthropic: buildCredential({ provider: 'anthropic', secret: 'ant-secret' }) });

    const result = await loadCredentials('user-3', ['openai', 'anthropic'], cache);

    expect(result).toEqual({ openai: openaiCred, anthropic: expect.objectContaining({ provider: 'anthropic' }) });
    expect(resolveSpy).toHaveBeenCalledWith('user-3', ['anthropic']);
    expect(cache.get('anthropic')).toEqual(expect.objectContaining({ provider: 'anthropic' }));
    resolveSpy.mockRestore();
  });
});
