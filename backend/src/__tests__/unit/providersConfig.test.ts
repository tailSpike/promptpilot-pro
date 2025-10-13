import { listProviders, providerRegistry } from '../../config/providers';

describe('provider registry', () => {
  it('lists all providers from registry', () => {
    const providers = listProviders();

    expect(providers).toHaveLength(Object.keys(providerRegistry).length);
    providers.forEach((provider) => {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('scopes');
    });
  });

  it('includes sandbox flag when defined', () => {
    const openai = providerRegistry.openai;

    expect(openai.sandbox).toBe(true);
    expect(openai.scopes).toContain('chat.completions');
  });
});
