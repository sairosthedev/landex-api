import config from '../config/index.js';
import { localFileStorage, objectStorage } from './storageService.js';

export function useMongoKycStorage() {
  const mode = config.storage.kycDocumentStorage;
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
