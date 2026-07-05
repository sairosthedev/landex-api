import { Complaint, ContactInquiry } from '../models/index.js';
import { generateReference } from '../utils/referenceGenerator.js';
import { pageResponse } from '../utils/apiResponse.js';

export async function submitComplaint(data) {
  const complaint = await Complaint.create({
    reference: generateReference('complaint'),
    subject: data.subject,
    against: data.against,
    reporterName: data.reporterName || data.name,
    reporterEmail: data.reporterEmail || data.email,
    reporterPhone: data.reporterPhone || data.phone,
    category: data.category,
    priority: data.priority || 'NORMAL',
    description: data.description,
    listingId: data.listingId,
  });
  return {
    reference: complaint.reference,
    message: 'Complaint submitted successfully. We will review your report.',
  };
}

export async function submitContactInquiry(data) {
  const inquiry = await ContactInquiry.create({
    reference: generateReference('contact'),
    name: data.name,
    email: data.email,
    phone: data.phone,
    topic: data.topic,
    message: data.message,
  });
  return {
    reference: inquiry.reference,
    message: 'Thank you for contacting us. We will respond shortly.',
  };
}

export async function listComplaints(pagination, status) {
  const { page, size, skip } = pagination;
  const filter = {};
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    Complaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
    Complaint.countDocuments(filter),
  ]);
  return pageResponse(items, page, size, total);
}

export async function getComplaintStats() {
  const stats = await Complaint.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(stats.map((s) => [s._id, s.count]));
}

export async function updateComplaintStatus(complaintId, status) {
  const complaint = await Complaint.findByIdAndUpdate(
    complaintId,
    { status },
    { new: true },
  );
  return complaint;
}

export async function listReferrals(pagination) {
  const { ContactRequest } = await import('../models/index.js');
  const { page, size, skip } = pagination;
  const [items, total] = await Promise.all([
    ContactRequest.find().sort({ createdAt: -1 }).skip(skip).limit(size)
      .populate('professionalId', 'firmName professionalType')
      .populate('requesterId', 'firstName lastName email'),
    ContactRequest.countDocuments(),
  ]);
  return pageResponse(items, page, size, total);
}

export async function updateReferralStatus(referralId, status) {
  const { ContactRequest } = await import('../models/index.js');
  return ContactRequest.findByIdAndUpdate(referralId, { status }, { new: true });
}
