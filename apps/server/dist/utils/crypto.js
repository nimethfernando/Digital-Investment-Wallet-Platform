"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptAtRest = encryptAtRest;
exports.decryptAtRest = decryptAtRest;
exports.generateSecureRandomToken = generateSecureRandomToken;
exports.sha256 = sha256;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // NIST SP 800-38D recommended 96-bit IV for GCM
const PREFIX = 'enc:v1:';
/**
 * Derives a 256-bit (32 byte) symmetric encryption key from server environment
 */
function getEncryptionKey() {
    const secret = process.env.ENCRYPTION_KEY || config_1.config.jwtSecret || 'avora_default_secure_vault_key_2026';
    return crypto_1.default.createHash('sha256').update(secret).digest();
}
/**
 * Encrypts sensitive data at rest using AES-256-GCM (Authenticated Encryption).
 * Output format: enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
function encryptAtRest(plaintext) {
    if (!plaintext)
        return plaintext;
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext}`;
}
/**
 * Decrypts AES-256-GCM encrypted data.
 * Gracefully falls back to plain text if the value is not encrypted (backward compatibility).
 */
function decryptAtRest(encryptedText) {
    if (!encryptedText)
        return '';
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
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (err) {
        throw new Error(`Cryptographic decryption failed: ${err.message}`);
    }
}
/**
 * Generates a cryptographically strong random token with 256 bits of entropy
 */
function generateSecureRandomToken(bytes = 32) {
    return crypto_1.default.randomBytes(bytes).toString('hex');
}
/**
 * Computes deterministic SHA-256 hash
 */
function sha256(data) {
    return crypto_1.default.createHash('sha256').update(data).digest('hex');
}
