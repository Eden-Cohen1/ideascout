import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { LlmRegistry, type LlmProviderStatus } from './llm/llm.registry';
import { ResearchRegistry, type ResearchProviderStatus } from './research/research.registry';

@ApiTags('providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly llm: LlmRegistry,
    private readonly research: ResearchRegistry,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List configured AI/research providers and their availability' })
  list(): { llm: LlmProviderStatus[]; research: ResearchProviderStatus[] } {
    return { llm: this.llm.available(), research: this.research.available() };
  }
}
