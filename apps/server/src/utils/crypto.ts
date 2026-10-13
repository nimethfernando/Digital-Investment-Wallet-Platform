import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // NIST SP 800-38D recommended 96-bit IV for GCM
const PREFIX = 'enc:v1:';

/**
 * Derives a 256-bit (32 byte) symmetric encryption key from server environment
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || config.jwtSecret || 'avora_default_secure_vault_key_2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts sensitive data at rest using AES-256-GCM (Authenticated Encryption).
 * Output format: enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
export function encryptAtRest(plaintext: string): string {
  if (!plaintext) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypts AES-256-GCM encrypted data.
 * Gracefully falls back to plain text if the value is not encrypted (backward compatibility).
 */
export function decryptAtRest(encryptedText: string | null | undefined): string {
  if (!encryptedText) return '';

  // If not encrypted with our prefix, return as-is (e.g. legacy or unencrypted string)
  if (!encryptedText.startsWith(PREFIX)) {
    return encryptedText;
  }

  try {
    const parts = encryptedText.substring(PREFIX.length).split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted payload format');
    }

    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: any) {
    throw new Error(`Cryptographic decryption failed: ${err.message}`);
  }
}

/**
 * Generates a cryptographically strong random token with 256 bits of entropy
 */
export function generateSecureRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Computes deterministic SHA-256 hash
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

