import {
  VerificationRequest, VerificationStatusHistory, VerificationDocument,
  PropertyListing, User,
} from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { generateReference } from '../utils/referenceGenerator.js';
import { pageResponse } from '../utils/apiResponse.js';
import * as auditService from './auditService.js';

function toResponse(req) {
  return {
    id: req._id.toString(),
    requestReference: req.requestReference,
    reference: req.requestReference,
    verificationType: req.verificationType,
    status: req.status,
    listingId: req.listingId?.toString(),
    sellerId: req.sellerId?.toString(),
    requestedBy: req.requestedBy?.toString(),
    assignedReviewer: req.assignedReviewer?.toString(),
    priority: req.priority,
    notes: req.notes,
    rejectionReason: req.rejectionReason,
    submittedAt: req.submittedAt,
    reviewStartedAt: req.reviewStartedAt,
    completedAt: req.completedAt,
    createdAt: req.createdAt,
  };
}

async function enrichVerificationResponse(req) {
  const response = toResponse(req);
  if (req.listingId) {
    const listing = await PropertyListing.findById(req.listingId).select(
      'title province district tenureType listingReference sellerId status',
    );
    if (listing) {
      response.listingTitle = listing.title;
      response.listingReference = listing.listingReference;
      response.province = listing.province;
      response.district = listing.district;
      response.tenureType = listing.tenureType;
      response.listingStatus = listing.status;
      if (!response.sellerId) response.sellerId = listing.sellerId?.toString();
    }
  }

  const sellerId = response.sellerId ?? req.requestedBy?.toString();
  if (sellerId) {
    const seller = await User.findById(sellerId).select('firstName lastName email');
    if (seller) {
      response.sellerName = [seller.firstName, seller.lastName].filter(Boolean).join(' ').trim() || seller.email;
      response.sellerEmail = seller.email;
    }
  }

  return response;
}

export async function repairSubmittedListingStatuses() {
  const submitted = await VerificationRequest.find({
    verificationType: 'LISTING',
    status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
    listingId: { $ne: null },
  }).select('listingId');

  await Promise.all(submitted.map((request) => PropertyListing.updateOne(
    { _id: request.listingId, deletedAt: null, status: 'DRAFT' },
    { status: 'PENDING_REVIEW' },
  )));

  const approved = await VerificationRequest.find({
    verificationType: 'LISTING',
    status: 'APPROVED',
    listingId: { $ne: null },
  }).select('listingId');

  await Promise.all(approved.map((request) => PropertyListing.updateOne(
    { _id: request.listingId, deletedAt: null, status: { $in: ['DRAFT', 'PENDING_REVIEW'] } },
    { status: 'ACTIVE', verified: true, publishedAt: new Date() },
  )));
}

async function linkVerificationDocuments(requestId, documentIds = []) {
  for (const documentId of documentIds) {
    if (!documentId) continue;
    await VerificationDocument.findOneAndUpdate(
      { verificationRequestId: requestId, documentId },
      { verificationRequestId: requestId, documentId },
      { upsert: true },
    );
  }
}

async function recordStatusChange(requestId, fromStatus, toStatus, changedBy, reason) {
  await VerificationStatusHistory.create({
    verificationRequestId: requestId,
    fromStatus,
    toStatus,
    changedBy,
    reason,
  });
}

export async function createRequest(userId, data) {
  let sellerId = data.sellerId;
  if (data.listingId) {
    const listing = await PropertyListing.findOne({ _id: data.listingId, deletedAt: null });
    if (!listing) throw AppError.notFound('Listing not found');
    sellerId = listing.sellerId;
  }

  const request = await VerificationRequest.create({
    requestReference: generateReference('verification'),
    verificationType: data.verificationType,
    listingId: data.listingId,
    sellerId,
    requestedBy: userId,
    priority: data.priority || 'NORMAL',
    notes: data.notes,
    metadata: data.metadata,
  });

  await linkVerificationDocuments(request._id, data.documentIds);

  return toResponse(request);
}

export async function getQueue(pagination, filters = {}) {
  const { page, size, skip } = pagination;
  const filter = { status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } };
  if (filters.status) filter.status = filters.status;
  if (filters.type) filter.verificationType = filters.type;
  const [items, total] = await Promise.all([
    VerificationRequest.find(filter).sort({ priority: -1, submittedAt: 1 }).skip(skip).limit(size),
    VerificationRequest.countDocuments(filter),
  ]);
  const content = await Promise.all(items.map(enrichVerificationResponse));
  return pageResponse(content, page, size, total);
}

export async function getMyRequests(userId, pagination) {
  const { page, size, skip } = pagination;
  const filter = { requestedBy: userId };
  const [items, total] = await Promise.all([
    VerificationRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
    VerificationRequest.countDocuments(filter),
  ]);
  return pageResponse(items.map(toResponse), page, size, total);
}

export async function getById(userId, requestId) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw AppError.notFound('Verification request not found');
  return toResponse(request);
}

export async function submit(userId, requestId) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw AppError.notFound('Verification request not found');
  if (request.requestedBy.toString() !== userId) throw AppError.forbidden();
  const from = request.status;
  request.status = 'SUBMITTED';
  request.submittedAt = new Date();
  await request.save();
  await recordStatusChange(requestId, from, 'SUBMITTED', userId);

  if (request.verificationType === 'LISTING' && request.listingId) {
    await PropertyListing.findOneAndUpdate(
      { _id: request.listingId, deletedAt: null, status: 'DRAFT' },
      { status: 'PENDING_REVIEW' },
    );
  }

  return toResponse(request);
}

export async function assignReviewer(userId, requestId, reviewerId) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw AppError.notFound('Verification request not found');
  request.assignedReviewer = reviewerId;
  await request.save();
  return toResponse(request);
}

export async function startReview(userId, requestId) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw AppError.notFound('Verification request not found');
  const from = request.status;
  request.status = 'UNDER_REVIEW';
  request.reviewStartedAt = new Date();
  request.assignedReviewer = userId;
  await request.save();
  await recordStatusChange(requestId, from, 'UNDER_REVIEW', userId);
  return toResponse(request);
}

export async function addNote(userId, requestId, note) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw AppError.notFound('Verification request not found');
  request.notes = request.notes ? `${request.notes}\n${note}` : note;
  await request.save();
  return toResponse(request);
}

export async function reviewDocuments(userId, requestId, reviews) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw AppError.notFound('Verification request not found');
  for (const r of reviews || []) {
    await VerificationDocument.findOneAndUpdate(
      { verificationRequestId: requestId, documentId: r.documentId },
      { $setOnInsert: { verificationRequestId: requestId, documentId: r.documentId } },
      { upsert: true },
    );
  }
  return toResponse(request);
}

export async function requestMoreInfo(userId, requestId, reason) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw AppError.notFound('Verification request not found');
  const from = request.status;
  request.status = 'ADDITIONAL_INFO_REQUIRED';
  request.notes = reason;
  await request.save();
  await recordStatusChange(requestId, from, 'ADDITIONAL_INFO_REQUIRED', userId, reason);
  return toResponse(request);
}

export async function approve(userId, requestId, auditCtx) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw AppError.notFound('Verification request not found');
  const from = request.status;
  request.status = 'APPROVED';
  request.completedAt = new Date();
  await request.save();
  await recordStatusChange(requestId, from, 'APPROVED', userId);

  if (request.verificationType === 'LISTING' && request.listingId) {
    const before = await PropertyListing.findById(request.listingId);
    const listing = await PropertyListing.findOneAndUpdate(
      { _id: request.listingId, deletedAt: null },
      { status: 'ACTIVE', verified: true, publishedAt: new Date() },
      { new: true },
    );
    if (auditCtx && listing) {
      await auditService.recordAudit(auditCtx, {
        action: 'APPROVE',
        entitySchema: 'listing',
        entityId: listing._id,
        entityReference: listing.listingReference ?? listing.title,
        beforeState: { status: before?.status },
        afterState: { status: 'ACTIVE' },
      });
    }
  }

  if (auditCtx) {
    await auditService.recordAudit(auditCtx, {
      action: 'APPROVE',
      entitySchema: 'verification',
      entityId: request._id,
      entityReference: request.requestReference,
      beforeState: { status: from },
      afterState: { status: 'APPROVED' },
    });
  }
  return toResponse(request);
}

export async function reject(userId, requestId, reason, auditCtx) {
  const request = await VerificationRequest.findById(requestId);
  if (!request) throw AppError.notFound('Verification request not found');
  const from = request.status;
  request.status = 'REJECTED';
  request.rejectionReason = reason;
  request.completedAt = new Date();
  await request.save();
  await recordStatusChange(requestId, from, 'REJECTED', userId, reason);

  if (request.verificationType === 'LISTING' && request.listingId) {
    const before = await PropertyListing.findById(request.listingId);
    const listing = await PropertyListing.findOneAndUpdate(
      { _id: request.listingId, deletedAt: null },
      { status: 'REJECTED', rejectionReason: reason },
      { new: true },
    );
    if (auditCtx && listing) {
      await auditService.recordAudit(auditCtx, {
        action: 'REJECT',
        entitySchema: 'listing',
        entityId: listing._id,
        entityReference: listing.listingReference ?? listing.title,
        beforeState: { status: before?.status },
        afterState: { status: 'REJECTED', reason },
      });
    }
  }

  if (auditCtx) {
    await auditService.recordAudit(auditCtx, {
      action: 'REJECT',
      entitySchema: 'verification',
      entityId: request._id,
      entityReference: request.requestReference,
      beforeState: { status: from },
      afterState: { status: 'REJECTED', reason },
    });
  }
  return toResponse(request);
}
