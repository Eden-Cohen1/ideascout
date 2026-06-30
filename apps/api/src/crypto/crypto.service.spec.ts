import { CryptoService } from './crypto.service';
import { AppConfigService } from '../config/config.service';
import type { AppConfig } from '../config/config.schema';

function configWith(encryptionKey: string): AppConfigService {
  return new AppConfigService({ APP_ENCRYPTION_KEY: encryptionKey } as AppConfig);
}

const validKey = Buffer.alloc(32, 7).toString('base64');

describe('CryptoService', () => {
  const crypto = new CryptoService(configWith(validKey));

  it('round-trips encrypt -> decrypt', () => {
    const secret = 'sk-super-secret-api-key';
    const enc = crypto.encrypt(secret);
    expect(crypto.decrypt(enc)).toBe(secret);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = crypto.encrypt('same');
    const b = crypto.encrypt('same');
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.iv.equals(b.iv)).toBe(false);
  });

  it('fails to decrypt when the auth tag is tampered with', () => {
    const enc = crypto.encrypt('tamper-me');
    const badTag = Buffer.from(enc.authTag);
    badTag[0] ^= 0xff;
    expect(() => crypto.decrypt({ ...enc, authTag: badTag })).toThrow();
  });

  it('throws when the key does not decode to 32 bytes', () => {
    expect(() => new CryptoService(configWith(Buffer.alloc(16).toString('base64')))).toThrow();
  });
});
