import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hashes a password to something other than the plaintext, and verifies it', async () => {
    const hash = await svc.hash('s3cret-password');
    expect(hash).not.toBe('s3cret-password');
    expect(await svc.verify(hash, 's3cret-password')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await svc.hash('correct-horse');
    expect(await svc.verify(hash, 'wrong-horse')).toBe(false);
  });
});
