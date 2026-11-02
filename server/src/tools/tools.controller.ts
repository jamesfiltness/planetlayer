import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import type { MapRow } from '../maps/map.js';
import { CurrentMap, MapExistsGuard } from '../maps/map-exists.guard.js';
import { ToolsService } from './tools.service.js';

// The body is checked by the tool itself, since each tool takes different fields.
@Controller('api/maps/:mapId/tools')
@UseGuards(MapExistsGuard)
export class ToolsController {
  constructor(private readonly tools: ToolsService) {}

  @Post(':tool')
  @HttpCode(HttpStatus.OK)
  run(@CurrentMap() map: MapRow, @Param('tool') tool: string, @Body() params: unknown) {
    return this.tools.run(map.id, tool, params);
  }
}
