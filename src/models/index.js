import mongoose from 'mongoose';
import {
  USER_STATUSES, ROLES, LISTING_STATUSES, LISTING_TYPES, PROPERTY_TYPES, TENURE_TYPES,
  DOCUMENT_TYPES, KYC_DOCUMENT_TYPES, KYC_STATUSES, VERIFICATION_TYPES, VERIFICATION_STATUSES,
  ENQUIRY_STATUSES, PROFESSIONAL_TYPES, PROFESSIONAL_STATUSES, INVOICE_STATUSES,
  PAYMENT_STATUSES, PAYMENT_METHODS, NOTIFICATION_CHANNELS, COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES, CHECKLIST_TYPES,
} from '../constants/index.js';

const { Schema } = mongoose;

const baseOpts = { timestamps: true, versionKey: '__v' };

// --- Auth tokens ---
const refreshTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  deviceInfo: String,
  ipAddress: String,
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
}, baseOpts);

const passwordResetTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  usedAt: Date,
}, baseOpts);

const emailVerificationTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
}, baseOpts);

const loginAttemptSchema = new Schema({
  email: { type: String, required: true, index: true },
  ipAddress: String,
  userAgent: String,
  successful: { type: Boolean, required: true },
  failureReason: String,
  attemptedAt: { type: Date, default: Date.now },
});

// --- Users ---
const addressSchema = new Schema({
  addressType: { type: String, default: 'HOME' },
  street: String,
  suburb: String,
  city: String,
  province: String,
  postalCode: String,
  country: { type: String, default: 'Zimbabwe' },
  isPrimary: { type: Boolean, default: false },
}, { _id: true });

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  phoneNumber: { type: String, required: true },
  passwordHash: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  nationalIdEnc: { type: Buffer },
  dateOfBirth: Date,
  profileImageUrl: String,
  status: { type: String, enum: USER_STATUSES, default: 'PENDING_VERIFICATION' },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  roles: [{ type: String, enum: Object.values(ROLES) }],
  addresses: [addressSchema],
  lastLoginAt: Date,
  deletedAt: Date,
}, baseOpts);

userSchema.index({ phoneNumber: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

const kycDocumentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  documentType: { type: String, enum: KYC_DOCUMENT_TYPES, required: true },
  status: { type: String, default: 'UPLOADED' },
  storageKey: String,
  originalFilename: String,
  contentType: String,
  size: Number,
  sha256: String,
  verifiedAt: Date,
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String,
  active: { type: Boolean, default: true },
}, baseOpts);

const userKycStatusSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, enum: KYC_STATUSES, default: 'NOT_SUBMITTED' },
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String,
}, baseOpts);

// --- Seller / Buyer ---
const sellerProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  sellerType: { type: String, enum: ['INDIVIDUAL', 'COMPANY'], default: 'INDIVIDUAL' },
  companyName: String,
  bio: String,
  verificationStatus: { type: String, default: 'NOT_VERIFIED' },
  totalListings: { type: Number, default: 0 },
  activeListings: { type: Number, default: 0 },
}, baseOpts);

const buyerProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  verificationStatus: { type: String, default: 'NOT_VERIFIED' },
  financingStatus: String,
  preferredCurrency: { type: String, default: 'USD' },
  totalEnquiries: { type: Number, default: 0 },
}, baseOpts);

const savedListingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  listingId: { type: Schema.Types.ObjectId, ref: 'PropertyListing', required: true },
  savedAt: { type: Date, default: Date.now },
}, baseOpts);
savedListingSchema.index({ userId: 1, listingId: 1 }, { unique: true });

const checklistProgressSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  listingId: { type: Schema.Types.ObjectId, ref: 'PropertyListing' },
  checklistType: { type: String, enum: CHECKLIST_TYPES, required: true },
  checkedItems: { type: Map, of: Boolean, default: {} },
}, baseOpts);
checklistProgressSchema.index({ userId: 1, listingId: 1, checklistType: 1 }, { unique: true });

// --- Listings ---
const propertyListingSchema = new Schema({
  listingReference: { type: String, unique: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  listingType: { type: String, enum: LISTING_TYPES, required: true },
  status: { type: String, enum: LISTING_STATUSES, default: 'DRAFT' },
  title: { type: String, required: true },
  description: String,
  askingPrice: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  priceNegotiable: { type: Boolean, default: false },
  propertyType: { type: String, enum: PROPERTY_TYPES, required: true },
  tenureType: { type: String, enum: TENURE_TYPES },
  areaSqm: Number,
  province: String,
  district: String,
  ward: String,
  locality: String,
  address: String,
  titleNumber: String,
  parcelNumber: String,
  standNumber: String,
  erfNumber: String,
  latitude: Number,
  longitude: Number,
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] },
  },
  featured: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  publishedAt: Date,
  deletedAt: Date,
}, baseOpts);
propertyListingSchema.index({ location: '2dsphere' }, { sparse: true });
propertyListingSchema.index({ status: 1, province: 1, askingPrice: 1 });

const propertyImageSchema = new Schema({
  listingId: { type: Schema.Types.ObjectId, ref: 'PropertyListing', required: true, index: true },
  storageKey: { type: String, required: true },
  originalFilename: String,
  contentType: String,
  size: Number,
  sha256: String,
  altText: String,
  sortOrder: { type: Number, default: 0 },
  primary: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, baseOpts);

// --- Documents ---
const propertyDocumentSchema = new Schema({
  listingId: { type: Schema.Types.ObjectId, ref: 'PropertyListing', index: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
  status: { type: String, default: 'UPLOADED' },
  storageKey: { type: String, required: true },
  originalFilename: String,
  contentType: String,
  size: Number,
  sha256: String,
  isPublic: { type: Boolean, default: false },
  verifiedAt: Date,
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String,
  metadata: Schema.Types.Mixed,
  virusScanStatus: { type: String, default: 'SKIPPED' },
  deletedAt: Date,
}, baseOpts);

const documentAccessLogSchema = new Schema({
  documentId: { type: Schema.Types.ObjectId, ref: 'PropertyDocument', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  ipAddress: String,
  accessedAt: { type: Date, default: Date.now },
});

// --- Verification ---
const verificationRequestSchema = new Schema({
  requestReference: { type: String, unique: true },
  verificationType: { type: String, enum: VERIFICATION_TYPES, required: true },
  status: { type: String, enum: VERIFICATION_STATUSES, default: 'DRAFT' },
  listingId: { type: Schema.Types.ObjectId, ref: 'PropertyListing' },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User' },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedReviewer: { type: Schema.Types.ObjectId, ref: 'User' },
  priority: { type: String, default: 'NORMAL' },
  submittedAt: Date,
  reviewStartedAt: Date,
  completedAt: Date,
  rejectionReason: String,
  notes: String,
  metadata: Schema.Types.Mixed,
}, baseOpts);

const verificationDocumentSchema = new Schema({
  verificationRequestId: { type: Schema.Types.ObjectId, ref: 'VerificationRequest', required: true },
  documentId: { type: Schema.Types.ObjectId, ref: 'PropertyDocument', required: true },
}, baseOpts);

const verificationReviewSchema = new Schema({
  verificationRequestId: { type: Schema.Types.ObjectId, ref: 'VerificationRequest', required: true },
  documentId: { type: Schema.Types.ObjectId, ref: 'PropertyDocument' },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  decision: String,
  comments: String,
  reviewedAt: { type: Date, default: Date.now },
}, baseOpts);

const verificationStatusHistorySchema = new Schema({
  verificationRequestId: { type: Schema.Types.ObjectId, ref: 'VerificationRequest', required: true },
  fromStatus: String,
  toStatus: String,
  changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reason: String,
  changedAt: { type: Date, default: Date.now },
});

// --- Enquiries ---
const enquirySchema = new Schema({
  enquiryReference: { type: String, unique: true },
  listingId: { type: Schema.Types.ObjectId, ref: 'PropertyListing', required: true },
  buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  initialMessage: { type: String, required: true },
  status: { type: String, enum: ENQUIRY_STATUSES, default: 'OPEN' },
  preferredContact: String,
  buyerRead: { type: Boolean, default: true },
  sellerRead: { type: Boolean, default: false },
  lastMessageAt: { type: Date, default: Date.now },
  closedAt: Date,
  closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, baseOpts);

const enquiryMessageSchema = new Schema({
  enquiryId: { type: Schema.Types.ObjectId, ref: 'Enquiry', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
}, baseOpts);

// --- Professionals ---
const professionalProfileSchema = new Schema({
  profileReference: { type: String, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  professionalType: { type: String, enum: PROFESSIONAL_TYPES, required: true },
  status: { type: String, enum: PROFESSIONAL_STATUSES, default: 'PENDING' },
  firmName: String,
  licenseNumber: String,
  bio: String,
  province: String,
  district: String,
  specializations: [String],
  phoneNumber: String,
  email: String,
  website: String,
  approvedAt: Date,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String,
}, baseOpts);

const contactRequestSchema = new Schema({
  reference: { type: String, unique: true },
  professionalId: { type: Schema.Types.ObjectId, ref: 'ProfessionalProfile', required: true },
  requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  listingId: { type: Schema.Types.ObjectId, ref: 'PropertyListing' },
  subject: String,
  message: String,
  status: { type: String, default: 'PENDING' },
  preferredContact: String,
}, baseOpts);

// --- Payments ---
const feeScheduleSchema = new Schema({
  feeCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  isPercentage: { type: Boolean, default: false },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveTo: Date,
  active: { type: Boolean, default: true },
}, baseOpts);

const invoiceSchema = new Schema({
  invoiceNumber: { type: String, unique: true },
  payerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  feeCode: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  referenceType: String,
  referenceId: { type: Schema.Types.ObjectId },
  dueDate: Date,
  status: { type: String, enum: INVOICE_STATUSES, default: 'PENDING' },
  paidAt: Date,
}, baseOpts);

const paymentSchema = new Schema({
  paymentReference: { type: String, unique: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  payerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  method: { type: String, enum: PAYMENT_METHODS },
  status: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING' },
  gatewayProvider: String,
  gatewayResponse: Schema.Types.Mixed,
  initiatedAt: { type: Date, default: Date.now },
  completedAt: Date,
}, baseOpts);

const paymentWebhookEventSchema = new Schema({
  provider: { type: String, required: true },
  externalId: { type: String, required: true },
  payload: Schema.Types.Mixed,
  processedAt: { type: Date, default: Date.now },
}, baseOpts);
paymentWebhookEventSchema.index({ provider: 1, externalId: 1 }, { unique: true });

const reconciliationRunSchema = new Schema({
  runReference: String,
  startedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  status: { type: String, default: 'RUNNING' },
  summary: Schema.Types.Mixed,
}, baseOpts);

// --- Notifications ---
const notificationSchema = new Schema({
  recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  channel: { type: String, enum: NOTIFICATION_CHANNELS, default: 'IN_APP' },
  status: { type: String, default: 'SENT' },
  subject: String,
  body: String,
  templateCode: String,
  referenceType: String,
  referenceId: { type: Schema.Types.ObjectId },
  metadata: Schema.Types.Mixed,
  sentAt: { type: Date, default: Date.now },
  readAt: Date,
}, baseOpts);

const notificationPreferenceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  eventType: { type: String, required: true },
  channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
  enabled: { type: Boolean, default: true },
}, baseOpts);
notificationPreferenceSchema.index({ userId: 1, eventType: 1, channel: 1 }, { unique: true });

// --- Audit ---
const auditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  actorEmail: String,
  action: { type: String, required: true },
  entitySchema: String,
  entityTable: String,
  entityId: { type: Schema.Types.ObjectId },
  entityReference: String,
  ipAddress: String,
  userAgent: String,
  requestMethod: String,
  requestPath: String,
  beforeState: Schema.Types.Mixed,
  afterState: Schema.Types.Mixed,
  occurredAt: { type: Date, default: Date.now },
}, baseOpts);

// --- Trust ---
const complaintSchema = new Schema({
  reference: { type: String, unique: true },
  subject: { type: String, required: true },
  against: String,
  reporterName: String,
  reporterEmail: String,
  reporterPhone: String,
  category: { type: String, enum: COMPLAINT_CATEGORIES, required: true },
  priority: { type: String, default: 'NORMAL' },
  status: { type: String, enum: COMPLAINT_STATUSES, default: 'OPEN' },
  description: { type: String, required: true },
  listingId: { type: Schema.Types.ObjectId, ref: 'PropertyListing' },
}, baseOpts);

const contactInquirySchema = new Schema({
  reference: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  topic: String,
  message: { type: String, required: true },
}, baseOpts);

// --- Exports ---
export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
export const EmailVerificationToken = mongoose.model('EmailVerificationToken', emailVerificationTokenSchema);
export const LoginAttempt = mongoose.model('LoginAttempt', loginAttemptSchema);
export const User = mongoose.model('User', userSchema);
export const KycDocument = mongoose.model('KycDocument', kycDocumentSchema);
export const UserKycStatus = mongoose.model('UserKycStatus', userKycStatusSchema);
export const SellerProfile = mongoose.model('SellerProfile', sellerProfileSchema);
export const BuyerProfile = mongoose.model('BuyerProfile', buyerProfileSchema);
export const SavedListing = mongoose.model('SavedListing', savedListingSchema);
export const ChecklistProgress = mongoose.model('ChecklistProgress', checklistProgressSchema);
export const PropertyListing = mongoose.model('PropertyListing', propertyListingSchema);
export const PropertyImage = mongoose.model('PropertyImage', propertyImageSchema);
export const PropertyDocument = mongoose.model('PropertyDocument', propertyDocumentSchema);
export const DocumentAccessLog = mongoose.model('DocumentAccessLog', documentAccessLogSchema);
export const VerificationRequest = mongoose.model('VerificationRequest', verificationRequestSchema);
export const VerificationDocument = mongoose.model('VerificationDocument', verificationDocumentSchema);
export const VerificationReview = mongoose.model('VerificationReview', verificationReviewSchema);
export const VerificationStatusHistory = mongoose.model('VerificationStatusHistory', verificationStatusHistorySchema);
export const Enquiry = mongoose.model('Enquiry', enquirySchema);
export const EnquiryMessage = mongoose.model('EnquiryMessage', enquiryMessageSchema);
export const ProfessionalProfile = mongoose.model('ProfessionalProfile', professionalProfileSchema);
export const ContactRequest = mongoose.model('ContactRequest', contactRequestSchema);
export const FeeSchedule = mongoose.model('FeeSchedule', feeScheduleSchema);
export const Invoice = mongoose.model('Invoice', invoiceSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const PaymentWebhookEvent = mongoose.model('PaymentWebhookEvent', paymentWebhookEventSchema);
export const ReconciliationRun = mongoose.model('ReconciliationRun', reconciliationRunSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const Complaint = mongoose.model('Complaint', complaintSchema);
export const ContactInquiry = mongoose.model('ContactInquiry', contactInquirySchema);
