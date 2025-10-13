import crypto from 'crypto';

interface EncryptionResult {
  ciphertext: string;
  iv: string;
  authTag: string;
}

const DEFAULT_LOCAL_FALLBACK_KEY = 'promptpilot-local-dev-master-key';

function deriveKey(rawKey: string): Buffer {
  return crypto.createHash('sha256').update(rawKey).digest();
}

function getMasterKey(): Buffer {
  const key = process.env.KMS_MASTER_KEY;
  if (key && key.trim().length > 0) {
    return deriveKey(key.trim());
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('KMS_MASTER_KEY must be configured in production environments');
  }

  console.warn('[KeyVaultService] Using fallback master key for local development only.');
  return deriveKey(DEFAULT_LOCAL_FALLBACK_KEY);
}

function encodePayload(result: EncryptionResult): string {
  return Buffer.from(`${result.iv}:${result.ciphertext}:${result.authTag}`, 'utf8').toString('base64');
}

function decodePayload(payload: string): EncryptionResult {
  const decoded = Buffer.from(payload, 'base64').toString('utf8');
  const parts = decoded.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload');
  }
  const [iv, ciphertext, authTag] = parts as [string, string, string];
  return { iv, ciphertext, authTag };
}

export class KeyVaultService {
  static encryptSecret(secret: string): string {
    if (!secret || secret.trim().length === 0) {
      throw new Error('Secret cannot be empty');
    }

    const key = getMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return encodePayload({
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    });
  }

  static decryptSecret(payload: string): string {
    const { iv, ciphertext, authTag } = decodePayload(payload);
    const key = getMasterKey();

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  static fingerprint(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }
}
