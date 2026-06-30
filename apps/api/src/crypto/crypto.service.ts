import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AppConfigService } from '../config/config.service';

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * AES-256-GCM encryption for secrets stored at rest (e.g. per-project provider
 * credentials). Authenticated encryption: tampering is detected on decrypt.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: AppConfigService) {
    this.key = Buffer.from(config.encryptionKey, 'base64');
    if (this.key.length !== 32) {
      throw new Error('APP_ENCRYPTION_KEY must decode to 32 bytes (base64 of a 256-bit key)');
    }
  }

  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return { ciphertext, iv, authTag: cipher.getAuthTag() };
  }

  decrypt(payload: EncryptedPayload): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, payload.iv);
    decipher.setAuthTag(payload.authTag);
    return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]).toString('utf8');
  }
}
