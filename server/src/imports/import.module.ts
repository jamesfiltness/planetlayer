import { Module } from '@nestjs/common';
import { LayersModule } from '../layers/layers.module.js';
import { MapsModule } from '../maps/maps.module.js';
import { ImportController } from './import.controller.js';
import { ImportService } from './import.service.js';

@Module({
  imports: [MapsModule, LayersModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
