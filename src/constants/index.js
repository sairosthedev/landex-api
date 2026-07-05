export const ROLES = {
  SUPER_ADMIN: 'ROLE_SUPER_ADMIN',
  ADMIN: 'ROLE_ADMIN',
  BUYER: 'ROLE_BUYER',
  SELLER: 'ROLE_SELLER',
  AGENT: 'ROLE_AGENT',
  CONVEYANCER: 'ROLE_CONVEYANCER',
  VERIFICATION_OFFICER: 'ROLE_VERIFICATION_OFFICER',
  LAWYER: 'ROLE_LAWYER',
  SURVEYOR: 'ROLE_SURVEYOR',
};

export const REGISTRATION_ROLES = ['BUYER', 'SELLER', 'AGENT', 'CONVEYANCER'];

export const USER_STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

export const LISTING_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SOLD', 'LEASED', 'WITHDRAWN', 'REJECTED'];

export const LISTING_TYPES = ['SALE', 'LEASE', 'RENT'];

export const PROPERTY_TYPES = [
  'RESIDENTIAL_STAND', 'COMMERCIAL_STAND', 'INDUSTRIAL_STAND', 'AGRICULTURAL_LAND',
  'FARM', 'RURAL_RESIDENTIAL', 'URBAN_RESIDENTIAL', 'MIXED_USE', 'OTHER',
];

export const TENURE_TYPES = ['FREEHOLD', 'LEASEHOLD', 'CUSTOMARY', 'STATE_LAND', 'OTHER'];

export const DOCUMENT_TYPES = [
  'TITLE_DEED', 'SURVEY_PLAN', 'RATE_CLEARANCE', 'ID_COPY', 'PROOF_OF_OWNERSHIP',
  'OFFER_LETTER', 'LEASE_AGREEMENT', 'OTHER',
];

export const KYC_DOCUMENT_TYPES = ['NATIONAL_ID', 'PROOF_OF_ADDRESS', 'SELFIE', 'PASSPORT', 'OTHER'];

export const KYC_STATUSES = ['NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED'];

export const VERIFICATION_TYPES = [
  'LISTING', 'TITLE_DEED', 'OWNERSHIP', 'AGENT_LICENSE', 'CONVEYANCER_LICENSE', 'SELLER_KYC',
];

export const VERIFICATION_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED',
];

export const ENQUIRY_STATUSES = ['OPEN', 'RESPONDED', 'CLOSED'];

export const PROFESSIONAL_TYPES = ['CONVEYANCER', 'LAWYER', 'ESTATE_AGENT', 'SURVEYOR'];

export const PROFESSIONAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];

export const INVOICE_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];

export const PAYMENT_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'];

export const PAYMENT_METHODS = ['PAYNOW', 'STRIPE', 'BANK_TRANSFER', 'CASH'];

export const NOTIFICATION_CHANNELS = ['EMAIL', 'SMS', 'IN_APP', 'PUSH'];

export const COMPLAINT_CATEGORIES = ['FRAUD', 'MISREPRESENTATION', 'HARASSMENT', 'SPAM', 'OTHER'];

export const COMPLAINT_STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'];

export const CHECKLIST_TYPES = ['DUE_DILIGENCE', 'DLAP_READINESS'];

export const REQUIRED_KYC_DOCUMENTS = ['NATIONAL_ID', 'PROOF_OF_ADDRESS', 'SELFIE'];

export const DEFAULT_FEE_SCHEDULE = [
  { feeCode: 'LISTING_PUBLISH', name: 'Listing Publication Fee', amount: 25, currency: 'USD', isPercentage: false },
  { feeCode: 'VERIFICATION', name: 'Property Verification Fee', amount: 50, currency: 'USD', isPercentage: false },
  { feeCode: 'PREMIUM_LISTING', name: 'Premium Listing Fee', amount: 100, currency: 'USD', isPercentage: false },
];

export const PUBLIC_ROUTES = [
  { method: 'POST', path: '/api/v1/auth/register' },
  { method: 'POST', path: '/api/v1/auth/login' },
  { method: 'POST', path: '/api/v1/auth/refresh' },
  { method: 'POST', path: '/api/v1/auth/forgot-password' },
  { method: 'POST', path: '/api/v1/auth/reset-password' },
  { method: 'POST', path: '/api/v1/auth/verify-email' },
  { method: 'POST', path: '/api/v1/auth/resend-verification' },
  { method: 'GET', path: '/api/v1/listings' },
  { method: 'GET', path: '/api/v1/listings/:id' },
  { method: 'GET', path: '/api/v1/listings/:listingId/images' },
  { method: 'GET', path: '/api/v1/listing-images/:imageId/content' },
  { method: 'GET', path: '/api/v1/professionals' },
  { method: 'GET', path: '/api/v1/professionals/:id' },
  { method: 'POST', path: '/api/v1/complaints' },
  { method: 'POST', path: '/api/v1/contact/inquiries' },
  { method: 'POST', path: '/api/v1/payments/webhooks/paynow' },
  { method: 'POST', path: '/api/v1/payments/webhooks/stripe' },
  { method: 'GET', path: '/health' },
];
