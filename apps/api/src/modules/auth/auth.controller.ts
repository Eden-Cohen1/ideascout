import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import {
  type AuthResponse,
  type AuthUser,
  type LoginRequest,
  LoginRequestSchema,
  type RegisterRequest,
  RegisterRequestSchema,
} from '@ideascout/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/current-user.decorator';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(RegisterRequestSchema)) dto: RegisterRequest,
  ): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body(new ZodValidationPipe(LoginRequestSchema)) dto: LoginRequest): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<AuthUser> {
    const user = await this.users.findById(current.id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, displayName: user.displayName };
  }
}
