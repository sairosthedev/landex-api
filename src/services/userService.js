import {
  User, KycDocument, UserKycStatus, RefreshToken,
} from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { decryptPii, sha256 } from '../utils/crypto.js';
import { objectStorage } from './storageService.js';
import { useMongoKycStorage } from './kycDocumentStorage.js';
import config from '../config/index.js';
import { REQUIRED_KYC_DOCUMENTS } from '../constants/index.js';

function toProfileResponse(user) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
  return {
    id: user._id.toString(),
    email: user.email,
    fullName,
    phoneNumber: user.phoneNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    profileImageUrl: user.profileImageUrl,
    status: user.status,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    roles: user.roles,
    addresses: user.addresses || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getProfile(userId) {
  const user = await User.findById(userId).where({ deletedAt: null });
  if (!user) throw AppError.notFound('User not found');
  return toProfileResponse(user);
}

export async function updateProfile(userId, data) {
  const user = await User.findById(userId).where({ deletedAt: null });
  if (!user) throw AppError.notFound('User not found');

  if (data.phoneNumber && data.phoneNumber !== user.phoneNumber) {
    const existing = await User.findOne({ phoneNumber: data.phoneNumber, deletedAt: null, _id: { $ne: userId } });
    if (existing) throw AppError.conflict('Phone number is already in use');
    user.phoneNumber = data.phoneNumber;
  }
  if (data.firstName) user.firstName = data.firstName.trim();
  if (data.lastName) user.lastName = data.lastName.trim();
  if (data.dateOfBirth) user.dateOfBirth = new Date(data.dateOfBirth);
  if (data.profileImageUrl !== undefined) user.profileImageUrl = data.profileImageUrl;
  if (data.addresses) user.addresses = data.addresses;

  await user.save();
  return toProfileResponse(user);
}

export async function deactivateAccount(userId, reason) {
  const user = await User.findById(userId).where({ deletedAt: null });
  if (!user) throw AppError.notFound('User not found');
  user.status = 'DEACTIVATED';
  user.deletedAt = new Date();
  await user.save();
  await RefreshToken.updateMany({ userId }, { revoked: true });
  return { message: reason ? 'Account deactivated' : 'Account deactivated successfully' };
}

export async function uploadKycDocument(userId, documentType, file) {
  if (!file || !file.buffer?.length) {
    throw AppError.badRequest('EMPTY_FILE', 'File is required');
  }

  const existing = await KycDocument.findOne({ userId, documentType, active: true });
  if (existing) {
    throw AppError.conflict('Document type already uploaded');
  }

  const checksum = sha256(file.buffer);
  const safeName = file.originalname.replace(/[^\w.-]+/g, '_');
  const storageKey = `kyc/${userId}/${documentType}-${Date.now()}-${safeName}`;
  const useMongo = useMongoKycStorage();

  let inlineData;
  let storedKey = storageKey;

  if (useMongo) {
    inlineData = file.buffer;
  } else if (config.storage.kycDocumentStorage === 'object') {
    const uploaded = await objectStorage.upload(storageKey, file.buffer, file.mimetype);
    storedKey = uploaded.storageKey;
  } else {
    const { localFileStorage } = await import('./storageService.js');
    await localFileStorage.store(storageKey, file.buffer);
  }

  const doc = await KycDocument.create({
    userId,
    documentType,
    status: 'UPLOADED',
    storageKey: storedKey,
    inlineData,
    originalFilename: file.originalname,
    contentType: file.mimetype,
    size: file.size,
    sha256: checksum,
  });

  await UserKycStatus.findOneAndUpdate(
    { userId },
    { $setOnInsert: { status: 'NOT_SUBMITTED' } },
    { upsert: true },
  );

  return {
    id: doc._id.toString(),
    documentType: doc.documentType,
    status: doc.status,
    originalFilename: doc.originalFilename,
    uploadedAt: doc.createdAt,
  };
}

export async function listKycDocuments(userId) {
  const docs = await KycDocument.find({ userId, active: true }).sort({ createdAt: -1 });
  return docs.map((d) => ({
    id: d._id.toString(),
    documentType: d.documentType,
    status: d.status,
    originalFilename: d.originalFilename,
    uploadedAt: d.createdAt,
  }));
}

export async function getVerificationStatus(userId) {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('User not found');

  const kycStatus = await UserKycStatus.findOne({ userId });
  const uploaded = await KycDocument.find({ userId, active: true }).sort({ createdAt: -1 });
  const uploadedTypes = uploaded.map((d) => d.documentType);
  const missingDocuments = REQUIRED_KYC_DOCUMENTS.filter((t) => !uploadedTypes.includes(t));

  return {
    kycStatus: kycStatus?.status || 'NOT_SUBMITTED',
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    uploadedDocuments: uploaded.map((d) => ({
      id: d._id.toString(),
      documentType: d.documentType,
      status: d.status,
      originalFilename: d.originalFilename,
      contentType: d.contentType,
      uploadedAt: d.createdAt,
    })),
    requiredDocuments: REQUIRED_KYC_DOCUMENTS,
    missingDocuments,
  };
}

export function getUserNationalId(user) {
  if (!user.nationalIdEnc) return null;
  try {
    return decryptPii(user.nationalIdEnc);
  } catch {
    return null;
  }
}
