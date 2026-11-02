import type { MulterModuleOptions } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const MAX_UPLOAD = 500 * 1024 ** 2;

// GDAL picks a driver partly by extension, so the stored file keeps its own.
export const uploadOptions: MulterModuleOptions = {
  storage: diskStorage({ filename: (req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname)) }),
  limits: { fileSize: MAX_UPLOAD },
};
