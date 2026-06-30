import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from './current-user.decorator';
import { ACCESS_TOKEN_COOKIE } from '../modules/auth/auth-cookie.util';

interface JwtPayload {
  sub: string;
  email: string;
}

interface GuardedRequest {
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
  user?: AuthenticatedUser;
}

/** Verifies the JWT (cookie or Bearer header) and attaches { id, email } to the request. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const token =
      request.cookies?.[ACCESS_TOKEN_COOKIE] ?? this.extractToken(request.headers['authorization']);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      request.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(authorization: string | undefined): string | undefined {
    if (!authorization) return undefined;
    const [scheme, token] = authorization.split(' ');
    return scheme === 'Bearer' && token ? token : undefined;
  }
}
