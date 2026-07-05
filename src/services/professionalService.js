import {
  ProfessionalProfile, ContactRequest, User,
} from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { generateReference } from '../utils/referenceGenerator.js';
import { pageResponse } from '../utils/apiResponse.js';

const TYPE_ROLE_MAP = {
  CONVEYANCER: 'ROLE_CONVEYANCER',
  LAWYER: 'ROLE_LAWYER',
  ESTATE_AGENT: 'ROLE_AGENT',
  SURVEYOR: 'ROLE_SURVEYOR',
};

function toProfileResponse(profile) {
  return {
    id: profile._id.toString(),
    profileReference: profile.profileReference,
    userId: profile.userId?.toString(),
    professionalType: profile.professionalType,
    status: profile.status,
    firmName: profile.firmName,
    licenseNumber: profile.licenseNumber,
    bio: profile.bio,
    province: profile.province,
    district: profile.district,
    specializations: profile.specializations,
    phoneNumber: profile.phoneNumber,
    email: profile.email,
    website: profile.website,
    createdAt: profile.createdAt,
  };
}

export async function register(userId, data) {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('User not found');

  const existing = await ProfessionalProfile.findOne({ userId });
  if (existing) throw AppError.conflict('Professional profile already exists');

  const profile = await ProfessionalProfile.create({
    profileReference: generateReference('professional'),
    userId,
    professionalType: data.professionalType,
    firmName: data.firmName,
    licenseNumber: data.licenseNumber,
    bio: data.bio,
    province: data.province,
    district: data.district,
    specializations: data.specializations || [],
    phoneNumber: data.phoneNumber || user.phoneNumber,
    email: data.email || user.email,
    website: data.website,
  });

  return toProfileResponse(profile);
}

export async function search(criteria, pagination) {
  const { page, size, skip } = pagination;
  const filter = { status: 'APPROVED' };
  if (criteria.professionalType) filter.professionalType = criteria.professionalType;
  if (criteria.province) filter.province = new RegExp(criteria.province, 'i');
  if (criteria.district) filter.district = new RegExp(criteria.district, 'i');
  if (criteria.keyword) {
    filter.$or = [
      { firmName: new RegExp(criteria.keyword, 'i') },
      { bio: new RegExp(criteria.keyword, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    ProfessionalProfile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
    ProfessionalProfile.countDocuments(filter),
  ]);
  return pageResponse(items.map(toProfileResponse), page, size, total);
}

export async function getPending(pagination) {
  const { page, size, skip } = pagination;
  const filter = { status: 'PENDING' };
  const [items, total] = await Promise.all([
    ProfessionalProfile.find(filter).sort({ createdAt: 1 }).skip(skip).limit(size),
    ProfessionalProfile.countDocuments(filter),
  ]);
  return pageResponse(items.map(toProfileResponse), page, size, total);
}

export async function getMyProfile(userId) {
  const profile = await ProfessionalProfile.findOne({ userId });
  if (!profile) throw AppError.notFound('Professional profile not found');
  return toProfileResponse(profile);
}

export async function getById(profileId) {
  const profile = await ProfessionalProfile.findById(profileId);
  if (!profile || profile.status !== 'APPROVED') {
    throw AppError.notFound('Professional not found');
  }
  return toProfileResponse(profile);
}

export async function approve(adminId, profileId) {
  const profile = await ProfessionalProfile.findById(profileId);
  if (!profile) throw AppError.notFound('Professional profile not found');
  profile.status = 'APPROVED';
  profile.approvedAt = new Date();
  profile.approvedBy = adminId;
  await profile.save();
  return toProfileResponse(profile);
}

export async function reject(adminId, profileId, reason) {
  const profile = await ProfessionalProfile.findById(profileId);
  if (!profile) throw AppError.notFound('Professional profile not found');
  profile.status = 'REJECTED';
  profile.rejectionReason = reason;
  await profile.save();
  return toProfileResponse(profile);
}

export async function createContactRequest(userId, data) {
  const professional = await ProfessionalProfile.findById(data.professionalId);
  if (!professional || professional.status !== 'APPROVED') {
    throw AppError.notFound('Professional not found');
  }

  const request = await ContactRequest.create({
    reference: generateReference('contact'),
    professionalId: data.professionalId,
    requesterId: userId,
    listingId: data.listingId,
    subject: data.subject,
    message: data.message,
    preferredContact: data.preferredContact,
  });

  return {
    id: request._id.toString(),
    reference: request.reference,
    status: request.status,
    createdAt: request.createdAt,
  };
}

export async function getContactRequests(userId, pagination) {
  const profile = await ProfessionalProfile.findOne({ userId });
  if (!profile) return pageResponse([], pagination.page, pagination.size, 0);

  const { page, size, skip } = pagination;
  const [items, total] = await Promise.all([
    ContactRequest.find({ professionalId: profile._id }).sort({ createdAt: -1 }).skip(skip).limit(size),
    ContactRequest.countDocuments({ professionalId: profile._id }),
  ]);
  return pageResponse(items, page, size, total);
}

export async function getSentContactRequests(userId, pagination) {
  const { page, size, skip } = pagination;
  const [items, total] = await Promise.all([
    ContactRequest.find({ requesterId: userId }).sort({ createdAt: -1 }).skip(skip).limit(size),
    ContactRequest.countDocuments({ requesterId: userId }),
  ]);
  return pageResponse(items, page, size, total);
}

export { TYPE_ROLE_MAP };
