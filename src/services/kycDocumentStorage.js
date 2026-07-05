import config from '../config/index.js';
import { localFileStorage, objectStorage } from './storageService.js';

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function useMongoStorage(mode) {
  if (isServerlessRuntime()) return true;

  const normalized = (mode || 'mongodb').toLowerCase();
  if (normalized === 'mongodb' || normalized === 'mongo') return true;
  return normalized !== 'object' && normalized !== 'local';
}

export function useMongoKycStorage() {
  return useMongoStorage(config.storage.kycDocumentStorage);
}

export function useMongoPropertyDocumentStorage() {
  return useMongoStorage(config.storage.listingDocumentStorage);
}

async function readStoredDocumentBuffer(doc, storageMode) {
  if (doc.inlineData?.length) {
    return doc.inlineData;
  }
  if (!doc.storageKey) {
    throw new Error('Document has no stored content');
  }
  if (storageMode === 'object') {
    return objectStorage.download(doc.storageKey);
  }
  return localFileStorage.read(doc.storageKey);
}

export async function readKycDocumentBuffer(doc) {
  return readStoredDocumentBuffer(doc, config.storage.kycDocumentStorage);
}

export async function readPropertyDocumentBuffer(doc) {
  return readStoredDocumentBuffer(doc, config.storage.listingDocumentStorage);
}
