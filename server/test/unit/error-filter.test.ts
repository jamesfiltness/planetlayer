import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { ErrorFilter } from '../../src/common/error.filter.js';

function send(exception: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  new ErrorFilter().catch(exception, host);
  return [res.status.mock.calls[0][0], res.json.mock.calls[0][0]];
}

describe('ErrorFilter', () => {
  test('sends an HttpException as { error: message } with its status', () => {
    expect(send(new NotFoundException('That map is gone.'))).toEqual([404, { error: 'That map is gone.' }]);
  });

  test('sends the first of a validation error’s messages', () => {
    expect(send(new BadRequestException(['Give the map a name.', 'Another']))).toEqual([400, { error: 'Give the map a name.' }]);
  });

  test('logs anything else and sends it as a 500', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(send(new Error('boom'))).toEqual([500, { error: 'boom' }]);
    expect(stderr).toHaveBeenCalled();
    stderr.mockRestore();
  });
});
