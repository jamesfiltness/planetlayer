import { Module } from '@nestjs/common';
import { LayersModule } from '../layers/layers.module.js';
import { MapsModule } from '../maps/maps.module.js';
import { ToolsController } from './tools.controller.js';
import { ToolsService } from './tools.service.js';

@Module({
  imports: [MapsModule, LayersModule],
  controllers: [ToolsController],
  providers: [ToolsService],
})
export class ToolsModule {}
