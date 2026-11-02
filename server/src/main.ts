import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';
import { setUpApp } from './setup.js';

const app = setUpApp(await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn'] }));
const { port, listenAddress } = app.get(AppConfig);
await app.listen(port, listenAddress);
console.log(`Spatial Analysis on http://localhost:${port} (listening on ${listenAddress})`);
