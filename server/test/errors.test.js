// How errors become responses (http/errorHandler.js). Tested directly, as an
// unexpected error or a 500 MB upload is awkward to cause through the app.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import multer from 'multer';
import { badRequest } from '../errors.js';
import { describeError, SERVER_ERROR_MESSAGE } from '../http/errorHandler.js';

describe('errors', () => {
  test("an expected error keeps its status and message", () => {
    assert.deepEqual(describeError(badRequest('Give the map a name.')), { status: 400, message: 'Give the map a name.', expected: true });
  });

  test('an unexpected error is a 500 whose message gives nothing away', () => {
    const { status, message, expected } = describeError(new Error('relation "secret_table" does not exist'));
    assert.deepEqual([status, message, expected], [500, SERVER_ERROR_MESSAGE, false]);
  });

  test('a file over the upload limit is a 413, not a server error', () => {
    const { status, expected } = describeError(new multer.MulterError('LIMIT_FILE_SIZE', 'file'));
    assert.deepEqual([status, expected], [413, true]);
  });

  test('other upload problems are 400s', () => {
    assert.equal(describeError(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'other')).status, 400);
  });
});
