import {
  User, PropertyListing, KycDocument, Invoice, Payment,
  VerificationRequest, Complaint, ContactRequest, UserKycStatus,
} from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { pageResponse } from '../utils/apiResponse.js';
import { localFileStorage } from './storageService.js';
import { readKycDocumentBuffer } from './kycDocumentStorage.js';
import * as listingService from './listingService.js';
import * as paymentService from './paymentService.js';
import * as auditService from './auditService.js';
import * as verificationService from './verificationService.js';

function toAdminUserResponse(user, kycStatus) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName,
    phoneNumber: user.phoneNumber,
    status: user.status,
    roles: user.roles,
    emailVerified: user.emailVerified,
    kycStatus,
    createdAt: user.createdAt,
  };
}

async function kycStatusByUserIds(userIds) {
  if (!userIds.length) return {};
  const rows = await UserKycStatus.find({ userId: { $in: userIds } });
  return Object.fromEntries(rows.map((row) => [row.userId.toString(), row.status]));
}

export async function logAudit(data) {
  await auditService.recordAudit(
    { actorId: data.actorId, actorEmail: data.actorEmail },
    data,
  );
}

export async function searchAuditLogs(pagination, filters = {}) {
  return auditService.searchAuditLogs(pagination, filters);
}

export async function listUsers(pagination, filters = {}) {
  const { page, size, skip } = pagination;
  const query = { deletedAt: null };
  if (filters.status) query.status = filters.status;
  if (filters.role) {
    const role = String(filters.role).startsWith('ROLE_')
      ? String(filters.role)
      : `ROLE_${String(filters.role).toUpperCase()}`;
    query.roles = role;
  }
  if (filters.email) query.email = new RegExp(`^${String(filters.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (filters.keyword) {
    query.$or = [
      { email: new RegExp(filters.keyword, 'i') },
      { firstName: new RegExp(filters.keyword, 'i') },
      { lastName: new RegExp(filters.keyword, 'i') },
    ];
  }
  const [items, total] = await Promise.all([
    User.find(query).select('-passwordHash -nationalIdEnc').sort({ createdAt: -1 }).skip(skip).limit(size),
    User.countDocuments(query),
  ]);
  const kycMap = await kycStatusByUserIds(items.map((u) => u._id));
  const content = items.map((u) => toAdminUserResponse(u, kycMap[u._id.toString()]));
  return pageResponse(content, page, size, total);
}

export async function getUser(userId) {
  const user = await User.findById(userId).select('-passwordHash -nationalIdEnc');
  if (!user) throw AppError.notFound('User not found');
  const kyc = await UserKycStatus.findOne({ userId });
  return toAdminUserResponse(user, kyc?.status);
}

export async function updateUserStatus(userId, status, auditCtx) {
  const before = await User.findById(userId).select('-passwordHash -nationalIdEnc');
  if (!before) throw AppError.notFound('User not found');
  const user = await User.findByIdAndUpdate(userId, { status }, { new: true })
    .select('-passwordHash -nationalIdEnc');
  const kyc = await UserKycStatus.findOne({ userId });
  if (auditCtx) {
    await auditService.recordAudit(auditCtx, {
      action: 'UPDATE',
      entitySchema: 'user',
      entityId: user._id,
      entityReference: user.email,
      beforeState: { status: before.status },
      afterState: { status },
    });
  }
  return toAdminUserResponse(user, kyc?.status);
}

export async function updateUserRoles(userId, roles) {
  const user = await User.findByIdAndUpdate(userId, { roles }, { new: true })
    .select('-passwordHash -nationalIdEnc');
  if (!user) throw AppError.notFound('User not found');
  const kyc = await UserKycStatus.findOne({ userId });
  return toAdminUserResponse(user, kyc?.status);
}

export async function listKycDocuments(userId) {
  return KycDocument.find({ userId, active: true });
}

export async function downloadKycDocument(documentId) {
  const doc = await KycDocument.findById(documentId);
  if (!doc) throw AppError.notFound('Document not found');
  const buffer = await readKycDocumentBuffer(doc);
  return { buffer, contentType: doc.contentType, filename: doc.originalFilename };
}

export async function approveKyc(userId, adminId, auditCtx) {
  const user = await User.findById(userId).select('email');
  const result = await UserKycStatus.findOneAndUpdate(
    { userId },
    { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: adminId },
    { upsert: true, new: true },
  );
  if (auditCtx) {
    await auditService.recordAudit(auditCtx, {
      action: 'VERIFY',
      entitySchema: 'kyc',
      entityId: userId,
      entityReference: user?.email ?? userId,
      afterState: { status: 'APPROVED' },
    });
  }
  return result;
}

export async function rejectKyc(userId, adminId, reason, auditCtx) {
  const user = await User.findById(userId).select('email');
  const result = await UserKycStatus.findOneAndUpdate(
    { userId },
    { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: adminId, rejectionReason: reason },
    { upsert: true, new: true },
  );
  if (auditCtx) {
    await auditService.recordAudit(auditCtx, {
      action: 'REJECT',
      entitySchema: 'kyc',
      entityId: userId,
      entityReference: user?.email ?? userId,
      afterState: { status: 'REJECTED', reason },
    });
  }
  return result;
}

export async function listListings(pagination, status) {
  const { page, size, skip } = pagination;
  const filter = { deletedAt: null };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    PropertyListing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
    PropertyListing.countDocuments(filter),
  ]);
  const content = await Promise.all(
    items.map((l) => listingService.getListing(l._id.toString(), null, false).catch(() => null)),
  );
  return pageResponse(content.filter(Boolean), page, size, total);
}

export async function approveListing(listingId, auditCtx) {
  const before = await PropertyListing.findById(listingId);
  if (!before) throw AppError.notFound('Listing not found');
  const listing = await PropertyListing.findByIdAndUpdate(
    listingId,
    { status: 'ACTIVE', publishedAt: new Date() },
    { new: true },
  );
  if (auditCtx) {
    await auditService.recordAudit(auditCtx, {
      action: 'APPROVE',
      entitySchema: 'listing',
      entityId: listing._id,
      entityReference: listing.listingReference ?? listing.title,
      beforeState: { status: before.status },
      afterState: { status: 'ACTIVE' },
    });
  }
  return listing;
}

export async function rejectListing(listingId, reason, auditCtx) {
  const before = await PropertyListing.findById(listingId);
  if (!before) throw AppError.notFound('Listing not found');
  const listing = await PropertyListing.findByIdAndUpdate(
    listingId,
    { status: 'REJECTED', rejectionReason: reason },
    { new: true },
  );
  if (auditCtx) {
    await auditService.recordAudit(auditCtx, {
      action: 'REJECT',
      entitySchema: 'listing',
      entityId: listing._id,
      entityReference: listing.listingReference ?? listing.title,
      beforeState: { status: before.status },
      afterState: { status: 'REJECTED', reason },
    });
  }
  return listing;
}

export async function withdrawListing(listingId) {
  const listing = await PropertyListing.findByIdAndUpdate(
    listingId,
    { status: 'WITHDRAWN', deletedAt: new Date() },
    { new: true },
  );
  if (!listing) throw AppError.notFound('Listing not found');
  return listing;
}

export async function getVerificationQueue(pagination, filters = {}) {
  return verificationService.getQueue(pagination, filters);
}

export async function getVerificationStats() {
  const stats = await VerificationRequest.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(stats.map((s) => [s._id, s.count]));
}

export async function getDashboard() {
  const [
    totalUsers, activeListings, pendingVerifications, openComplaints,
    totalInvoices, paidInvoices,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    PropertyListing.countDocuments({ status: 'ACTIVE', deletedAt: null }),
    VerificationRequest.countDocuments({ status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
    Complaint.countDocuments({ status: 'OPEN' }),
    Invoice.countDocuments(),
    Invoice.countDocuments({ status: 'PAID' }),
  ]);

  const paymentSummary = await paymentService.getPaymentSummary();

  return {
    users: { total: totalUsers },
    listings: { active: activeListings },
    verifications: { pending: pendingVerifications },
    complaints: { open: openComplaints },
    payments: paymentSummary,
    referrals: { pending: await ContactRequest.countDocuments({ status: 'PENDING' }) },
  };
}

export async function listInvoices(pagination) {
  const { page, size, skip } = pagination;
  const [items, total] = await Promise.all([
    Invoice.find().sort({ createdAt: -1 }).skip(skip).limit(size),
    Invoice.countDocuments(),
  ]);
  return pageResponse(items, page, size, total);
}

export async function listPayments(pagination) {
  const { page, size, skip } = pagination;
  const [items, total] = await Promise.all([
    Payment.find().sort({ initiatedAt: -1 }).skip(skip).limit(size),
    Payment.countDocuments(),
  ]);
  return pageResponse(items, page, size, total);
}

export async function listReconciliationRuns(pagination) {
  const { ReconciliationRun } = await import('../models/index.js');
  const { page, size, skip } = pagination;
  const [items, total] = await Promise.all([
    ReconciliationRun.find().sort({ startedAt: -1 }).skip(skip).limit(size),
    ReconciliationRun.countDocuments(),
  ]);
  return pageResponse(items, page, size, total);
}
