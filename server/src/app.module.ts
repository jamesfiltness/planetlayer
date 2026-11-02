import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { MapsModule } from './maps/maps.module.js';
@Module({
  imports: [ConfigModule, DatabaseModule, MapsModule],
})
export class AppModule {}
