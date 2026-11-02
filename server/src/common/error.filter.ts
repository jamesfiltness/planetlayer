import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

// Every error goes out as { error: message }, which the client shows to the
// user. An HttpException is expected; anything else is a bug, so it's logged.
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json({ error: messageOf(exception) });
      return;
    }
    this.logger.error(exception);
    const message = exception instanceof Error ? exception.message : 'Something went wrong.';
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

// ValidationPipe puts its messages in a list; the first is enough.
function messageOf(exception: HttpException): string {
  const body = exception.getResponse();
  const message = typeof body === 'object' && body !== null && 'message' in body ? body.message : body;
  return String(Array.isArray(message) ? message[0] : message);
}
