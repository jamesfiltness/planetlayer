import { BadRequestException, Controller, HttpCode, HttpStatus, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { rm } from 'node:fs/promises';
import type { MapRow } from '../maps/map.js';
import { CurrentMap, MapExistsGuard } from '../maps/map-exists.guard.js';
import { ImportService } from './import.service.js';
import { uploadOptions } from './upload-options.js';

@Controller('api/maps/:mapId/import')
@UseGuards(MapExistsGuard)
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async import(@CurrentMap() map: MapRow, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded.');
    try {
      return await this.imports.importFile(file, map.id);
    } finally {
      await rm(file.path, { force: true });
    }
  }
}
