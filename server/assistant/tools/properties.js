// The tool for changing a layer's properties: calculating one from an
// expression. It changes the layer in place, as the Properties tab of the
// layer editor does, rather than making a new one.
import * as z from 'zod';
import { FUNCTIONS } from '../../../shared/expression.js';
import { MAX_PROPERTY_NAME } from '../../../shared/limits.js';
import { calculateProperty } from '../../properties/calculate.js';
import { layerId } from '../schemas.js';

export const propertyTools = [
  {
    name: 'calculate_property',
    title: 'Calculate a property',
    description:
      'Sets a property on every feature of a layer from an arithmetic expression on its other properties, '
      + 'such as `pop_est / building_count` or `round(area_sqkm * 100, 1)`. Replaces the property if it exists. '
      + 'To turn numbers stored as text into numbers, recalculate the property as `number(pop_est)`: it reads text such as "23.5", '
      + 'and leaves anything else (such as "n/a") empty. '
      + 'Use + - * /, brackets, numbers, and '
      + `${Object.keys(FUNCTIONS).map((f) => `${f}()`).join(', ')} (round takes optional digits). `
      + 'Write a property\'s name as it is, or in double quotes if it has spaces or other characters: "area sq km". '
      + 'Otherwise only properties stored as numbers are used; others, and dividing by zero, give an empty value. '
      + 'Gives back how many features got a number and how many were left empty.',
    input: {
      layer_id: layerId(),
      name: z.string().describe(`The property to set, new or existing, at most ${MAX_PROPERTY_NAME} characters.`),
      expression: z.string().describe('The expression to work out for each feature.'),
    },
    run: async ({ layer_id, name, expression }) => ({ layer_id, ...(await calculateProperty(layer_id, { name, expression })) }),
  },
];
