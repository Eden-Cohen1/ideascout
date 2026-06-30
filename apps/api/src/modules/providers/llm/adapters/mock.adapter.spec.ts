import { VerdictSchema } from '@ideascout/shared';
import { MockLlmProvider } from './mock.adapter';

describe('MockLlmProvider', () => {
  const provider = new MockLlmProvider();

  it('is always available (no key needed)', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  it('chat returns mock text', async () => {
    const result = await provider.chat([{ role: 'user', content: 'hello' }]);
    expect(result.text).toContain('MOCK');
    expect(result.finishReason).toBe('stop');
  });

  it('structured returns a schema-valid, deterministic value', async () => {
    const a = await provider.structured([{ role: 'user', content: 'x' }], VerdictSchema);
    expect(() => VerdictSchema.parse(a.value)).not.toThrow();
    const b = await provider.structured([{ role: 'user', content: 'x' }], VerdictSchema);
    expect(b.value).toEqual(a.value);
  });

  it('stream yields chunks and terminates with done', async () => {
    const chunks = [];
    for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.at(-1)).toEqual({ delta: '', done: true });
  });
});
