import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';
import {config} from '../config.js';

const key = createHash('sha256').update(config.FIELD_ENCRYPTION_KEY).digest();

export type EncryptedValue = {ciphertext: Buffer; iv: Buffer; tag: Buffer};

export const encryptSensitive = (value: string | null | undefined): EncryptedValue | null => {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {ciphertext, iv, tag: cipher.getAuthTag()};
};

export const decryptSensitive = (value: EncryptedValue | null): string | null => {
  if (!value) return null;
  const decipher = createDecipheriv('aes-256-gcm', key, value.iv);
  decipher.setAuthTag(value.tag);
  return Buffer.concat([decipher.update(value.ciphertext), decipher.final()]).toString('utf8');
};
