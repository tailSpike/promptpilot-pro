import { KeyVaultService } from '../../lib/keyVault';

const originalEnv = { ...process.env };
const originalWarn = console.warn;

describe('KeyVaultService', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    console.warn = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
    console.warn = originalWarn;
  });

  it('round-trips secrets with configured master key', () => {
    process.env.KMS_MASTER_KEY = 'unit-master-key';

    const encrypted = KeyVaultService.encryptSecret('super-secret-value');
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toContain('super-secret-value');

    const decrypted = KeyVaultService.decryptSecret(encrypted);
    expect(decrypted).toBe('super-secret-value');
  });

  it('falls back to development key when master key missing outside production', () => {
    delete process.env.KMS_MASTER_KEY;
    process.env.NODE_ENV = 'development';

    const encrypted = KeyVaultService.encryptSecret('local-secret');
    expect(typeof encrypted).toBe('string');
    expect(console.warn).toHaveBeenCalledWith('[KeyVaultService] Using fallback master key for local development only.');

    const decrypted = KeyVaultService.decryptSecret(encrypted);
    expect(decrypted).toBe('local-secret');
  });

  it('throws in production when master key is not configured', () => {
    delete process.env.KMS_MASTER_KEY;
    process.env.NODE_ENV = 'production';

    expect(() => KeyVaultService.encryptSecret('prod-secret')).toThrow('KMS_MASTER_KEY must be configured in production environments');
  });

  it('computes fingerprint hashes deterministically', () => {
    const fingerprint = KeyVaultService.fingerprint('hash-me');
    const second = KeyVaultService.fingerprint('hash-me');
    const different = KeyVaultService.fingerprint('something-else');

    expect(fingerprint).toBe(second);
    expect(fingerprint).not.toBe(different);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects empty secrets during encryption', () => {
    process.env.KMS_MASTER_KEY = 'unit-master-key';
    expect(() => KeyVaultService.encryptSecret('')).toThrow('Secret cannot be empty');
  });
});
