import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const MAX_MAP_NAME = 200;

export class MapNameDto {
  // class-validator runs these bottom to top, stopping at the first failure.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(MAX_MAP_NAME, { message: `Map names can be at most ${MAX_MAP_NAME} characters.` })
  @IsNotEmpty({ message: 'Give the map a name.' })
  @IsString({ message: 'Give the map a name.' })
  name: string;
}
