import { Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { LAYER_NOT_FOUND } from '../common/messages.js';
import { ParseIdPipe } from '../common/parse-id.pipe.js';
import type { MapRow } from '../maps/map.js';
import { CurrentMap, MapExistsGuard } from '../maps/map-exists.guard.js';
import { LayersService } from './layers.service.js';

const LayerId = () => Param('id', new ParseIdPipe(LAYER_NOT_FOUND));

// Layer ids are unique across maps, so only listing needs the map.
@Controller('api')
export class LayersController {
  constructor(private readonly layers: LayersService) {}

  @Get('maps/:mapId/layers')
  @UseGuards(MapExistsGuard)
  list(@CurrentMap() map: MapRow) {
    return this.layers.list(map.id);
  }

  @Delete('layers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@LayerId() id: number) {
    return this.layers.delete(id);
  }

  @Get('layers/:id/geojson')
  @Header('Content-Type', 'application/json; charset=utf-8')
  geoJson(@LayerId() id: number) {
    return this.layers.geoJson(id);
  }
}
