import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller.js';
import { GenerationService } from './generation.service.js';
import { PdfRendererService } from './pdf-renderer.service.js';

@Module({
  controllers: [GenerationController],
  providers: [GenerationService, PdfRendererService],
})
export class GenerationModule {}
