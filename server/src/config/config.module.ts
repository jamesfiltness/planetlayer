import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config.js';

// Tests replace AppConfig with overrideProvider() to point at their own database.
@Global()
@Module({
  providers: [{ provide: AppConfig, useFactory: () => AppConfig.fromEnv() }],
  exports: [AppConfig],
})
export class ConfigModule {}
