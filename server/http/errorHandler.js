import multer from 'multer';
import { MAX_UPLOAD } from './upload.js';

/** What the client is told when something unexpected goes wrong. */
export const SERVER_ERROR_MESSAGE = 'Something went wrong on the server. Its log has the details.';

/**
 * The status and message to send for an error.
 *
 * Errors with a `status` (see errors.js; Express's own body parser sets one
 * too) are expected and their message is meant for the user. Upload errors
 * from multer get a status here. Anything else is a bug: its message may
 * hold internal details such as SQL, so it's replaced with a general one.
 *
 * @param {Error & { status?: number }} error
 * @returns {{ status: number, message: string, expected: boolean }}
 */
export function describeError(error) {
  if (error instanceof multer.MulterError) {
    return error.code === 'LIMIT_FILE_SIZE'
      ? { status: 413, message: `Files can be at most ${MAX_UPLOAD / 1024 ** 2} MB.`, expected: true }
      : { status: 400, message: `Upload failed: ${error.message}.`, expected: true };
  }
  if (error.status) return { status: error.status, message: error.message, expected: true };
  return { status: 500, message: SERVER_ERROR_MESSAGE, expected: false };
}

/** Express error middleware: logs unexpected errors and answers `{ error }`. */
export function errorHandler(error, req, res, next) {
  const { status, message, expected } = describeError(error);
  if (!expected) console.error(error);
  if (res.headersSent) return next(error);
  res.status(status).json({ error: message });
}
