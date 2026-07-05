import multer from 'multer';
import config from '../config/index.js';
import { AppError } from '../utils/errors.js';

const memoryStorage = multer.memoryStorage();

export const kycUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: config.storage.maxKycFileSizeBytes },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(AppError.badRequest('INVALID_FILE_TYPE', 'File type not allowed'));
    }
    cb(null, true);
  },
});

export const documentUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: config.objectStorage.maxFileSizeBytes },
});

export const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: config.objectStorage.maxFileSizeBytes },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(AppError.badRequest('INVALID_FILE_TYPE', 'Only image files are allowed'));
    }
    cb(null, true);
  },
});
