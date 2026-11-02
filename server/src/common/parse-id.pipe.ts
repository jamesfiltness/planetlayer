import { NotFoundException, PipeTransform } from '@nestjs/common';
import { parseId } from './ids.js';

// Used as `new ParseIdPipe(message)`, so each route chooses its own 404 message.
export class ParseIdPipe implements PipeTransform<string, number> {
  constructor(private readonly notFoundMessage: string) {}

  transform(value: string): number {
    const id = parseId(value);
    if (id === null) throw new NotFoundException(this.notFoundMessage);
    return id;
  }
}
