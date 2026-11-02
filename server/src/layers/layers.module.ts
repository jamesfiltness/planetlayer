import { Module } from '@nestjs/common';
import { MapsModule } from '../maps/maps.module.js';
import { LayersController } from './layers.controller.js';
import { LayersService } from './layers.service.js';

@Module({
  imports: [MapsModule],
  controllers: [LayersController],
  providers: [LayersService],
  exports: [LayersService],
})
export class LayersModule {}
