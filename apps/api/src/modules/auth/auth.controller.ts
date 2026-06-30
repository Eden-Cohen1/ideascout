import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AuthResponse,
  type AuthUser,
  type LoginRequest,
  LoginRequestSchema,
  type RegisterRequest,
  RegisterRequestSchema,
} from '@ideascout/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/current-user.decorator';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user and return a JWT' })
  @ApiZodBody(RegisterRequestSchema)
  register(
    @Body(new ZodValidationPipe(RegisterRequestSchema)) dto: RegisterRequest,
  ): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in with email + password and return a JWT' })
  @ApiZodBody(LoginRequestSchema)
  login(@Body(new ZodValidationPipe(LoginRequestSchema)) dto: LoginRequest): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  async me(@CurrentUser() current: AuthenticatedUser): Promise<AuthUser> {
    const user = await this.users.findById(current.id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, displayName: user.displayName };
  }
}
