import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/** Exported for unit testing the decorator's resolution logic. */
export function currentUserFactory(_data: unknown, ctx: ExecutionContext): AuthenticatedUser {
  return ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;
}

/** Injects the authenticated user into a route handler param. */
export const CurrentUser = createParamDecorator(currentUserFactory);
