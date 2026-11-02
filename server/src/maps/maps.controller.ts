import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { MAP_NOT_FOUND } from '../common/messages.js';
import { ParseIdPipe } from '../common/parse-id.pipe.js';
import { MapNameDto } from './map-name.dto.js';
import { MapsService } from './maps.service.js';

const MapId = () => Param('id', new ParseIdPipe(MAP_NOT_FOUND));

@Controller('api/maps')
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  @Get()
  list() {
    return this.maps.list();
  }

  @Post()
  create(@Body() { name }: MapNameDto) {
    return this.maps.create(name);
  }

  @Get(':id')
  get(@MapId() id: number) {
    return this.maps.get(id);
  }

  @Patch(':id')
  rename(@MapId() id: number, @Body() { name }: MapNameDto) {
    return this.maps.rename(id, name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@MapId() id: number) {
    return this.maps.delete(id);
  }
}
