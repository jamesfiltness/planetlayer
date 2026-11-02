import { Module } from '@nestjs/common';
import { MapExistsGuard } from './map-exists.guard.js';
import { MapsController } from './maps.controller.js';
import { MapsService } from './maps.service.js';

@Module({
  controllers: [MapsController],
  providers: [MapsService, MapExistsGuard],
  exports: [MapsService, MapExistsGuard],
})
export class MapsModule {}
