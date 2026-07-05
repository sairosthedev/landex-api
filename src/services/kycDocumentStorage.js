import config from '../config/index.js';
import { localFileStorage, objectStorage } from './storageService.js';

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function useMongoKycStorage() {
  if (isServerlessRuntime()) return true;

  const mode = (config.storage.kycDocumentStorage || 'mongodb').toLowerCase();
  if (mode === 'mongodb' || mode === 'mongo') return true;
  return mode !== 'object' && mode !== 'local';
}

export async function readKycDocumentBuffer(doc) {
  if (doc.inlineData?.length) {
    return doc.inlineData;
  }
  if (!doc.storageKey) {
    throw new Error('KYC document has no stored content');
  }
  if (config.storage.kycDocumentStorage === 'object') {
    return objectStorage.download(doc.storageKey);
  }
  return localFileStorage.read(doc.storageKey);
}
