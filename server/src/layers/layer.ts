export type Shape = 'point' | 'line' | 'polygon';

export interface LayerRow {
  id: number;
  map_id: number;
  name: string;
  shape: Shape;
  color: string;
}
