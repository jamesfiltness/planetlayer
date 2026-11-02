import { NotFoundException } from '@nestjs/common';
import { parseId } from '../../src/common/ids.js';
import { ParseIdPipe } from '../../src/common/parse-id.pipe.js';

describe('parseId', () => {
  test.each([[1, 1], ['42', 42], [' 7 ', 7], [2 ** 31 - 1, 2 ** 31 - 1]])('%j is %j', (value, id) => {
    expect(parseId(value)).toBe(id);
  });

  test.each([0, -1, 1.5, 2 ** 31, '', '  ', 'abc', '1e3x', null, undefined, {}, [1]])('%j is not an id', (value) => {
    expect(parseId(value)).toBeNull();
  });
});

describe('ParseIdPipe', () => {
  test('turns an id into a number', () => {
    expect(new ParseIdPipe('gone').transform('12')).toBe(12);
  });

  test("an impossible id is a 404 with the route's message", () => {
    expect(() => new ParseIdPipe('That map is gone.').transform('abc')).toThrow(new NotFoundException('That map is gone.'));
  });
});
