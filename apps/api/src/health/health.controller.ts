import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. */
  @Get()
  check(): { status: string; service: string } {
    return { status: 'ok', service: 'ideascout-api' };
  }

  /** Readiness: dependencies (database) are reachable. */
  @Get('ready')
  async ready(): Promise<{ status: string; db: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', db: 'down' });
    }
  }
}
