import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Project } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Enforces per-project ownership (the entire access model). Runs after JwtAuthGuard.
 * Resolves the project id from `:projectId` or `:id`, 404s if it's missing or owned
 * by someone else (no existence leak), and attaches it to the request.
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params: Record<string, string | undefined>;
      project?: Project;
    }>();

    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const projectId = request.params.projectId ?? request.params.id;
    const project = projectId
      ? await this.prisma.project.findUnique({ where: { id: projectId } })
      : null;

    if (!project || project.ownerId !== user.id) {
      throw new NotFoundException('Project not found');
    }

    request.project = project;
    return true;
  }
}
