import path from 'path';
import {
  PropertyDocument, PropertyListing, DocumentAccessLog,
} from '../models/index.js';
import config from '../config/index.js';
import { AppError } from '../utils/errors.js';
import { sha256 } from '../utils/crypto.js';
import { localFileStorage, objectStorage } from './storageService.js';
import {
  readPropertyDocumentBuffer,
  useMongoPropertyDocumentStorage,
} from './kycDocumentStorage.js';

function toDocumentResponse(doc) {
  return {
    id: doc._id.toString(),
    listingId: doc.listingId?.toString(),
    sellerId: doc.sellerId?.toString(),
    documentType: doc.documentType,
    status: doc.status,
    originalFilename: doc.originalFilename,
    contentType: doc.contentType,
    size: doc.size,
    isPublic: doc.isPublic,
    virusScanStatus: doc.virusScanStatus,
    createdAt: doc.createdAt,
  };
}

async function uploadDocument(userId, { listingId, sellerId, documentType, file }) {
  if (!file?.buffer?.length) throw AppError.badRequest('EMPTY_FILE', 'File is required');

  const safeName = file.originalname.replace(/[^\w.-]+/g, '_');
  const storageKey = path.join(
    listingId ? `listings/${listingId}` : `sellers/${sellerId || userId}`,
    `${documentType}-${Date.now()}-${safeName}`,
  );
  const checksum = sha256(file.buffer);
  const useMongo = useMongoPropertyDocumentStorage();

  let inlineData;
  let storedKey = storageKey;

  if (useMongo) {
    inlineData = file.buffer;
  } else if (config.storage.listingDocumentStorage === 'object') {
    const uploaded = await objectStorage.upload(storageKey, file.buffer, file.mimetype);
    storedKey = uploaded.storageKey;
  } else {
    await localFileStorage.store(storageKey, file.buffer);
  }

  const doc = await PropertyDocument.create({
    listingId,
    sellerId: sellerId || userId,
    uploadedBy: userId,
    documentType,
    storageKey: storedKey,
    inlineData,
    originalFilename: file.originalname,
    contentType: file.mimetype,
    size: file.size,
    sha256: checksum,
  });

  return toDocumentResponse(doc);
}

export async function uploadTitleDeed(userId, listingId, file) {
  await assertListingAccess(userId, listingId);
  return uploadDocument(userId, { listingId, documentType: 'TITLE_DEED', file });
}

export async function uploadSurveyDiagram(userId, listingId, file) {
  await assertListingAccess(userId, listingId);
  return uploadDocument(userId, { listingId, documentType: 'SURVEY_PLAN', file });
}

export async function uploadSupporting(userId, listingId, file) {
  await assertListingAccess(userId, listingId);
  return uploadDocument(userId, { listingId, documentType: 'OTHER', file });
}

export async function uploadSellerIdCopy(userId, file) {
  return uploadDocument(userId, { sellerId: userId, documentType: 'ID_COPY', file });
}

export async function uploadGeneric(userId, listingId, documentType, file) {
  await assertListingAccess(userId, listingId);
  return uploadDocument(userId, { listingId, documentType, file });
}

async function assertListingAccess(userId, listingId) {
  const listing = await PropertyListing.findOne({ _id: listingId, deletedAt: null });
  if (!listing) throw AppError.notFound('Listing not found');
}

export async function getDocument(userId, documentId) {
  const doc = await PropertyDocument.findOne({ _id: documentId, deletedAt: null });
  if (!doc) throw AppError.notFound('Document not found');
  return toDocumentResponse(doc);
}

export async function listDocuments(userId, filters = {}) {
  const query = { deletedAt: null, uploadedBy: userId };
  if (filters.listingId) query.listingId = filters.listingId;
  if (filters.documentType) query.documentType = filters.documentType;
  const docs = await PropertyDocument.find(query).sort({ createdAt: -1 });
  return docs.map(toDocumentResponse);
}

export async function downloadDocument(userId, documentId, ipAddress) {
  const doc = await PropertyDocument.findOne({ _id: documentId, deletedAt: null });
  if (!doc) throw AppError.notFound('Document not found');

  await DocumentAccessLog.create({ documentId, userId, ipAddress });
  const buffer = await readPropertyDocumentBuffer(doc);
  return { buffer, contentType: doc.contentType, filename: doc.originalFilename };
}

export async function getPresignedUrl(userId, documentId) {
  const doc = await PropertyDocument.findOne({ _id: documentId, deletedAt: null });
  if (!doc) throw AppError.notFound('Document not found');
  if (useMongoPropertyDocumentStorage() || doc.inlineData?.length) {
    return {
      url: `/api/v1/documents/${doc._id.toString()}/download`,
      expiresInMinutes: 15,
    };
  }
  const url = await objectStorage.getPresignedUrl(doc.storageKey);
  return { url, expiresInMinutes: 15 };
}

export async function deleteDocument(userId, documentId) {
  const doc = await PropertyDocument.findOne({ _id: documentId, deletedAt: null });
  if (!doc) throw AppError.notFound('Document not found');
  doc.deletedAt = new Date();
  await doc.save();
  return { message: 'Document deleted successfully' };
}
