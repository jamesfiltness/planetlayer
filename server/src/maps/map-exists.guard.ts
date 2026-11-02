import { CanActivate, ExecutionContext, Injectable, NotFoundException, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { parseId } from '../common/ids.js';
import { MAP_NOT_FOUND } from '../common/messages.js';
import type { MapRow } from './map.js';
import { MapsService } from './maps.service.js';

// Not `map`, which Request already has as a stream method.
type RequestWithMap = Request & { currentMap?: MapRow };

// For routes under /api/maps/:mapId. Guards run before interceptors, so a file
// sent to a missing map is refused before the upload is read.
@Injectable()
export class MapExistsGuard implements CanActivate {
  constructor(private readonly maps: MapsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithMap>();
    const id = parseId(req.params.mapId);
    if (id === null) throw new NotFoundException(MAP_NOT_FOUND);
    req.currentMap = await this.maps.get(id);
    return true;
  }
}

// The map MapExistsGuard loaded.
export const CurrentMap = createParamDecorator(
  (_: unknown, context: ExecutionContext): MapRow => context.switchToHttp().getRequest<RequestWithMap>().currentMap!,
);
