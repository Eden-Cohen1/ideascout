import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from './current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
}

/** Verifies the Bearer JWT and attaches { id, email } to the request. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthenticatedUser }>();
    const token = this.extractToken(request.headers['authorization']);
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
