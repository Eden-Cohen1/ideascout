import type { ExecutionContext } from '@nestjs/common';
import { currentUserFactory } from './current-user.decorator';

describe('currentUserFactory', () => {
  it('returns request.user from the execution context', () => {
    const user = { id: 'u1', email: 'a@b.com' };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    expect(currentUserFactory(undefined, ctx)).toBe(user);
  });
});
