import {
  Enquiry, EnquiryMessage, PropertyListing, BuyerProfile,
} from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { generateReference } from '../utils/referenceGenerator.js';
import { pageResponse } from '../utils/apiResponse.js';

function toEnquiryResponse(enquiry, messages = []) {
  return {
    id: enquiry._id.toString(),
    enquiryReference: enquiry.enquiryReference,
    listingId: enquiry.listingId.toString(),
    buyerId: enquiry.buyerId.toString(),
    sellerId: enquiry.sellerId.toString(),
    subject: enquiry.subject,
    initialMessage: enquiry.initialMessage,
    status: enquiry.status,
    preferredContact: enquiry.preferredContact,
    lastMessageAt: enquiry.lastMessageAt,
    messages: messages.map((m) => ({
      id: m._id.toString(),
      senderId: m.senderId.toString(),
      message: m.message,
      sentAt: m.sentAt,
    })),
    createdAt: enquiry.createdAt,
  };
}

export async function createEnquiry(userId, data) {
  const listing = await PropertyListing.findOne({ _id: data.listingId, status: 'ACTIVE', deletedAt: null });
  if (!listing) throw AppError.notFound('Listing not found');

  const enquiry = await Enquiry.create({
    enquiryReference: generateReference('enquiry'),
    listingId: data.listingId,
    buyerId: userId,
    sellerId: listing.sellerId,
    subject: data.subject,
    initialMessage: data.message,
    preferredContact: data.preferredContact,
  });

  await EnquiryMessage.create({
    enquiryId: enquiry._id,
    senderId: userId,
    message: data.message,
  });

  await BuyerProfile.findOneAndUpdate(
    { userId },
    { $inc: { totalEnquiries: 1 } },
    { upsert: true },
  );

  return toEnquiryResponse(enquiry);
}

export async function getMyEnquiries(userId, pagination) {
  const { page, size, skip } = pagination;
  const [items, total] = await Promise.all([
    Enquiry.find({ buyerId: userId }).sort({ lastMessageAt: -1 }).skip(skip).limit(size),
    Enquiry.countDocuments({ buyerId: userId }),
  ]);
  return pageResponse(items.map((e) => toEnquiryResponse(e)), page, size, total);
}

export async function getInbox(userId, pagination) {
  const { page, size, skip } = pagination;
  const [items, total] = await Promise.all([
    Enquiry.find({ sellerId: userId }).sort({ lastMessageAt: -1 }).skip(skip).limit(size),
    Enquiry.countDocuments({ sellerId: userId }),
  ]);
  return pageResponse(items.map((e) => toEnquiryResponse(e)), page, size, total);
}

export async function getEnquiry(userId, enquiryId) {
  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) throw AppError.notFound('Enquiry not found');
  const isParticipant = [enquiry.buyerId, enquiry.sellerId].some((id) => id.toString() === userId);
  if (!isParticipant) throw AppError.forbidden();
  const messages = await EnquiryMessage.find({ enquiryId }).sort({ sentAt: 1 });
  return toEnquiryResponse(enquiry, messages);
}

export async function respond(userId, enquiryId, message) {
  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) throw AppError.notFound('Enquiry not found');
  if (enquiry.sellerId.toString() !== userId) throw AppError.forbidden();

  await EnquiryMessage.create({ enquiryId, senderId: userId, message });
  enquiry.status = 'RESPONDED';
  enquiry.sellerRead = true;
  enquiry.buyerRead = false;
  enquiry.lastMessageAt = new Date();
  await enquiry.save();
  return toEnquiryResponse(enquiry);
}

export async function addMessage(userId, enquiryId, message) {
  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) throw AppError.notFound('Enquiry not found');
  if (enquiry.buyerId.toString() !== userId) throw AppError.forbidden();

  await EnquiryMessage.create({ enquiryId, senderId: userId, message });
  enquiry.lastMessageAt = new Date();
  enquiry.buyerRead = true;
  enquiry.sellerRead = false;
  await enquiry.save();
  return toEnquiryResponse(enquiry);
}

export async function closeEnquiry(userId, enquiryId) {
  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) throw AppError.notFound('Enquiry not found');
  const isParticipant = [enquiry.buyerId, enquiry.sellerId].some((id) => id.toString() === userId);
  if (!isParticipant) throw AppError.forbidden();
  enquiry.status = 'CLOSED';
  enquiry.closedAt = new Date();
  enquiry.closedBy = userId;
  await enquiry.save();
  return { message: 'Enquiry closed successfully' };
}
