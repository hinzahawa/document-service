import {
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { GenerationService } from './generation.service.js';
import {
  generateRequestSchema,
  type GenerateRequest,
} from './generate-request.schema.js';

@Controller()
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('generate')
  @HttpCode(200)
  generate(@Body({ schema: generateRequestSchema }) request: GenerateRequest) {
    return this.generationService.generate(request);
  }
}
