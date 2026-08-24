import type { RequestHandler } from 'express';
import multer from 'multer';

import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadSizeBytes,
    files: 1,
    fields: 0,
    parts: 2,
  },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Only PDF files are supported'));
      return;
    }

    callback(null, true);
  },
});

export const uploadDocumentFile: RequestHandler = (request, response, next) => {
  upload.single('file')(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError(
            413,
            'FILE_TOO_LARGE',
            `PDF file must not exceed ${env.maxUploadSizeBytes} bytes`,
          ),
        );
        return;
      }

      next(new AppError(400, 'INVALID_MULTIPART_UPLOAD', 'Multipart upload is invalid'));
      return;
    }

    next(error);
  });
};
