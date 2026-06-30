import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { LlmRegistry, type LlmProviderStatus } from './llm/llm.registry';
import { ResearchRegistry, type ResearchProviderStatus } from './research/research.registry';

@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly llm: LlmRegistry,
    private readonly research: ResearchRegistry,
  ) {}

  /** Lists configured providers and whether each is active (has a key / is mock). */
  @Get()
  list(): { llm: LlmProviderStatus[]; research: ResearchProviderStatus[] } {
    return { llm: this.llm.available(), research: this.research.available() };
  }
}
