import dotenv from 'dotenv';
import { requireEnv, optionalEnv, optionalInt } from './env.js';

dotenv.config();

const config = {
  env: optionalEnv('NODE_ENV', 'development'),
  port: optionalInt('PORT', 8080),
  frontendBaseUrl: optionalEnv('FRONTEND_BASE_URL'),

  mongodb: {
    uri: optionalEnv('MONGODB_URI'),
  },

  redis: {
    host: optionalEnv('REDIS_HOST'),
    port: optionalInt('REDIS_PORT', 6379),
    password: optionalEnv('REDIS_PASSWORD') || undefined,
    ttlMs: optionalInt('CACHE_TTL_MS', 3_600_000),
  },

  jwt: {
    secret: optionalEnv('JWT_SECRET'),
    accessTokenExpirationMs: optionalInt('JWT_ACCESS_TOKEN_EXPIRATION_MS', 900_000),
    refreshTokenExpirationMs: optionalInt('JWT_REFRESH_TOKEN_EXPIRATION_MS', 604_800_000),
    issuer: optionalEnv('JWT_ISSUER', 'landex'),
  },

  encryption: {
    piiKey: optionalEnv('PII_ENCRYPTION_KEY'),
  },

  auth: {
    maxLoginAttempts: optionalInt('AUTH_MAX_LOGIN_ATTEMPTS', 5),
    lockoutDurationMinutes: optionalInt('AUTH_LOCKOUT_DURATION_MINUTES', 15),
    passwordResetExpirationMinutes: optionalInt('AUTH_PASSWORD_RESET_EXPIRATION_MINUTES', 60),
    emailVerificationExpirationHours: optionalInt('AUTH_EMAIL_VERIFICATION_EXPIRATION_HOURS', 24),
    bcryptRounds: optionalInt('BCRYPT_ROUNDS', 12),
  },

  storage: {
    basePath: optionalEnv('STORAGE_BASE_PATH'),
    maxKycFileSizeBytes: optionalInt('STORAGE_MAX_KYC_FILE_SIZE_BYTES', 10_485_760),
    /** mongodb = inline bytes in Atlas (works on Vercel). object = S3/MinIO. local = disk under STORAGE_BASE_PATH */
    listingImageStorage: optionalEnv('LISTING_IMAGE_STORAGE', 'mongodb'),
    listingDocumentStorage: optionalEnv('LISTING_DOCUMENT_STORAGE', 'mongodb'),
    kycDocumentStorage: optionalEnv('KYC_DOCUMENT_STORAGE', 'mongodb'),
  },

  objectStorage: {
    provider: optionalEnv('OBJECT_STORAGE_PROVIDER', 'local'),
    bucket: optionalEnv('OBJECT_STORAGE_BUCKET'),
    endpoint: optionalEnv('OBJECT_STORAGE_ENDPOINT'),
    accessKey: optionalEnv('OBJECT_STORAGE_ACCESS_KEY'),
    secretKey: optionalEnv('OBJECT_STORAGE_SECRET_KEY'),
    region: optionalEnv('OBJECT_STORAGE_REGION', 'us-east-1'),
    presignedUrlExpirationMinutes: optionalInt('OBJECT_STORAGE_PRESIGNED_URL_EXPIRATION_MINUTES', 15),
    maxFileSizeBytes: optionalInt('OBJECT_STORAGE_MAX_FILE_SIZE_BYTES', 20_971_520),
  },

  mail: {
    host: optionalEnv('MAIL_HOST'),
    port: optionalInt('MAIL_PORT', 587),
    username: optionalEnv('MAIL_USERNAME'),
    password: optionalEnv('RESEND_API_KEY') || optionalEnv('MAIL_PASSWORD'),
    from: optionalEnv('NOTIFICATION_FROM_EMAIL'),
    secure: optionalEnv('MAIL_SMTP_STARTTLS', 'true') === 'true',
  },

  payment: {
    invoiceDueDays: optionalInt('PAYMENT_INVOICE_DUE_DAYS', 7),
    defaultCurrency: optionalEnv('PAYMENT_DEFAULT_CURRENCY', 'USD'),
    paynow: {
      integrationId: optionalEnv('PAYNOW_INTEGRATION_ID'),
      integrationKey: optionalEnv('PAYNOW_INTEGRATION_KEY'),
      resultUrl: optionalEnv('PAYNOW_RESULT_URL'),
      returnUrl: optionalEnv('PAYNOW_RETURN_URL'),
      initiateUrl: optionalEnv('PAYNOW_INITIATE_URL'),
    },
    stripe: {
      secretKey: optionalEnv('STRIPE_SECRET_KEY'),
      webhookSecret: optionalEnv('STRIPE_WEBHOOK_SECRET'),
      successUrl: optionalEnv('STRIPE_SUCCESS_URL'),
      cancelUrl: optionalEnv('STRIPE_CANCEL_URL'),
    },
  },

  notification: {
    smsEnabled: optionalEnv('SMS_ENABLED') === 'true',
    smsFromNumber: optionalEnv('SMS_FROM_NUMBER'),
    smsApiKey: optionalEnv('SMS_API_KEY'),
    smsApiUrl: optionalEnv('SMS_API_URL'),
  },

  virusScan: {
    enabled: optionalEnv('VIRUS_SCAN_ENABLED') === 'true',
    blockDownloadUntilClean: optionalEnv('VIRUS_SCAN_BLOCK_DOWNLOAD_UNTIL_CLEAN', 'true') === 'true',
  },
};

const REQUIRED_FOR_SERVER = [
  'MONGODB_URI',
  'FRONTEND_BASE_URL',
  'JWT_SECRET',
  'PII_ENCRYPTION_KEY',
  'STORAGE_BASE_PATH',
  'OBJECT_STORAGE_BUCKET',
  'NOTIFICATION_FROM_EMAIL',
];

export function validateConfig() {
  const needsLocalDisk =
    config.storage.listingImageStorage === 'local'
    || config.storage.listingDocumentStorage === 'local'
    || config.storage.kycDocumentStorage === 'local'
    || config.objectStorage.provider === 'local';

  const required = [...REQUIRED_FOR_SERVER];
  if (!needsLocalDisk) {
    const diskOnly = new Set(['STORAGE_BASE_PATH', 'OBJECT_STORAGE_BUCKET']);
    for (let i = required.length - 1; i >= 0; i -= 1) {
      if (diskOnly.has(required[i])) required.splice(i, 1);
    }
  }

  for (const name of required) {
    requireEnv(name);
  }

  if (config.objectStorage.provider !== 'local') {
    requireEnv('OBJECT_STORAGE_ENDPOINT');
    requireEnv('OBJECT_STORAGE_ACCESS_KEY');
    requireEnv('OBJECT_STORAGE_SECRET_KEY');
  }
}

export default config;
