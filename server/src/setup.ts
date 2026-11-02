import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { clientPages } from './common/client-pages.js';
import { ErrorFilter } from './common/error.filter.js';
import { hostGuard } from './common/host-guard.js';
import { AppConfig } from './config/app-config.js';

// Shared by main.ts and the tests, so both run the app the same way. Call it
// before app.init(): Express runs these in the order they're added, ahead of
// Nest's routes.
export function setUpApp(app: NestExpressApplication) {
  const config = app.get(AppConfig);
  // First, so a refused request never reaches the API or the client's files.
  app.use(hostGuard(config.allowedHosts));
  app.useStaticAssets(config.clientDir, { index: false });
  app.use(clientPages(config.clientDir));
  app.useGlobalFilters(new ErrorFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, stopAtFirstError: true }));
  return app;
}
