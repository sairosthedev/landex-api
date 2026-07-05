import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import {
  User, RefreshToken, PasswordResetToken, EmailVerificationToken, LoginAttempt, Notification,
} from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { encryptPii, hashToken, generateSecureToken } from '../utils/crypto.js';
import { generateAccessToken } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail, isEmailEnabled } from './emailService.js';
import { ROLES } from '../constants/index.js';

const ROLE_MAP = {
  BUYER: ROLES.BUYER,
  SELLER: ROLES.SELLER,
  AGENT: ROLES.AGENT,
  CONVEYANCER: ROLES.CONVEYANCER,
};

export async function hashPassword(password) {
  return bcrypt.hash(password, config.auth.bcryptRounds);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function createRefreshToken(userId, ipAddress, userAgent) {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + config.jwt.refreshTokenExpirationMs);
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(token),
    ipAddress,
    deviceInfo: userAgent,
    expiresAt,
  });
  return token;
}

async function createEmailVerificationToken(user) {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + config.auth.emailVerificationExpirationHours * 3600_000);
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return token;
}

async function createPasswordResetToken(user) {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + config.auth.passwordResetExpirationMinutes * 60_000);
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return token;
}

function buildAuthResponse(user, accessToken, refreshToken) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
  return {
    userId: user._id.toString(),
    email: user.email,
    fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles,
    emailVerified: user.emailVerified,
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.jwt.accessTokenExpirationMs / 1000,
  };
}

export async function assertNotLocked(email, ipAddress) {
  const since = new Date(Date.now() - config.auth.lockoutDurationMinutes * 60_000);
  const failures = await LoginAttempt.countDocuments({
    email,
    ipAddress,
    successful: false,
    attemptedAt: { $gte: since },
  });
  if (failures >= config.auth.maxLoginAttempts) {
    throw AppError.accountLocked('Too many failed login attempts. Please try again later.');
  }
}

export async function recordLoginAttempt(email, ipAddress, userAgent, successful, failureReason) {
  await LoginAttempt.create({ email, ipAddress, userAgent, successful, failureReason });
}

export async function register(data) {
  const email = data.email.toLowerCase();
  if (await User.findOne({ email, deletedAt: null })) {
    throw AppError.conflict('Email is already registered');
  }
  if (await User.findOne({ phoneNumber: data.phoneNumber, deletedAt: null })) {
    throw AppError.conflict('Phone number is already registered');
  }

  const roleName = ROLE_MAP[data.role];
  if (!roleName) {
    throw AppError.badRequest('INVALID_ROLE', 'Registration role is not configured');
  }

  const user = await User.create({
    email,
    phoneNumber: data.phoneNumber,
    passwordHash: await hashPassword(data.password),
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    nationalIdEnc: encryptPii(data.nationalId.trim()),
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    status: 'ACTIVE',
    emailVerified: true,
    phoneVerified: true,
    roles: [roleName],
  });

  if (isEmailEnabled()) {
    const verificationToken = await createEmailVerificationToken(user);
    await sendVerificationEmail(user, verificationToken);
  }

  await Notification.create({
    recipientId: user._id,
    channel: 'IN_APP',
    subject: 'Welcome to LandEx',
    body: 'Your account is ready. Sign in to get started.',
    templateCode: 'USER_REGISTERED',
  });

  return { message: 'Registration successful. You can sign in now.' };
}

export async function login(data, ipAddress, userAgent) {
  const email = data.email.toLowerCase();
  await assertNotLocked(email, ipAddress);

  const user = await User.findOne({ email, deletedAt: null });
  if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
    await recordLoginAttempt(email, ipAddress, userAgent, false, 'INVALID_CREDENTIALS');
    throw AppError.unauthorized();
  }

  if (user.status === 'SUSPENDED') {
    await recordLoginAttempt(email, ipAddress, userAgent, false, 'SUSPENDED');
    throw AppError.forbidden('Your account has been suspended');
  }
  if (user.status === 'DEACTIVATED') {
    await recordLoginAttempt(email, ipAddress, userAgent, false, 'DEACTIVATED');
    throw AppError.forbidden('Your account has been deactivated');
  }

  user.lastLoginAt = new Date();
  await user.save();
  await recordLoginAttempt(email, ipAddress, userAgent, true);

  const accessToken = generateAccessToken(user);
  const refreshToken = await createRefreshToken(user._id, ipAddress, userAgent);
  return buildAuthResponse(user, accessToken, refreshToken);
}

export async function refreshToken(data, ipAddress, userAgent) {
  const tokenDoc = await RefreshToken.findOne({
    tokenHash: hashToken(data.refreshToken),
    revoked: false,
    expiresAt: { $gt: new Date() },
  });
  if (!tokenDoc) {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(tokenDoc.userId).where({ deletedAt: null });
  if (!user) {
    throw AppError.unauthorized('User not found');
  }

  tokenDoc.revoked = true;
  await tokenDoc.save();

  const newRefreshToken = await createRefreshToken(user._id, ipAddress, userAgent);
  const accessToken = generateAccessToken(user);
  return buildAuthResponse(user, accessToken, newRefreshToken);
}

export async function logout(userId, refreshToken) {
  if (refreshToken) {
    await RefreshToken.updateOne(
      { tokenHash: hashToken(refreshToken) },
      { revoked: true },
    );
  } else {
    await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
  }
  return { message: 'Logged out successfully' };
}

export async function forgotPassword(data) {
  const user = await User.findOne({ email: data.email.toLowerCase(), deletedAt: null });
  if (user && isEmailEnabled()) {
    const token = await createPasswordResetToken(user);
    await sendPasswordResetEmail(user, token);
  }
  return { message: 'If an account exists with that email, a password reset link has been sent.' };
}

export async function resetPassword(data) {
  const tokenDoc = await PasswordResetToken.findOne({
    tokenHash: hashToken(data.token),
    used: false,
  });
  if (!tokenDoc) {
    throw AppError.badRequest('INVALID_TOKEN', 'Invalid or expired password reset token');
  }
  if (tokenDoc.expiresAt < new Date()) {
    throw AppError.badRequest('TOKEN_EXPIRED', 'Password reset token has expired');
  }

  const user = await User.findById(tokenDoc.userId);
  user.passwordHash = await hashPassword(data.newPassword);
  await user.save();

  tokenDoc.used = true;
  tokenDoc.usedAt = new Date();
  await tokenDoc.save();
  await RefreshToken.updateMany({ userId: user._id }, { revoked: true });

  return { message: 'Password has been reset successfully' };
}

export async function changePassword(userId, data) {
  const user = await User.findById(userId).where({ deletedAt: null });
  if (!user) throw AppError.notFound('User not found');
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw AppError.badRequest('INVALID_PASSWORD', 'Current password is incorrect');
  }
  user.passwordHash = await hashPassword(data.newPassword);
  await user.save();
  return { message: 'Password changed successfully' };
}

export async function verifyEmail(data) {
  const tokenDoc = await EmailVerificationToken.findOne({
    tokenHash: hashToken(data.token),
    verified: false,
  });
  if (!tokenDoc) {
    throw AppError.badRequest('INVALID_TOKEN', 'Invalid verification token');
  }
  if (tokenDoc.expiresAt < new Date()) {
    throw AppError.badRequest('TOKEN_EXPIRED', 'Verification token has expired');
  }

  const user = await User.findById(tokenDoc.userId);
  if (user.emailVerified) {
    throw AppError.badRequest('ALREADY_VERIFIED', 'Email is already verified');
  }

  user.emailVerified = true;
  user.status = 'ACTIVE';
  await user.save();
  tokenDoc.verified = true;
  await tokenDoc.save();

  return { message: 'Email verified successfully' };
}

export async function resendVerification(data) {
  const user = await User.findOne({ email: data.email.toLowerCase(), deletedAt: null });
  if (!user) {
    return { message: 'If an account exists with that email, a verification link has been sent.' };
  }
  if (user.emailVerified) {
    throw AppError.badRequest('ALREADY_VERIFIED', 'Email is already verified');
  }
  if (isEmailEnabled()) {
    const token = await createEmailVerificationToken(user);
    await sendVerificationEmail(user, token);
  } else {
    user.emailVerified = true;
    if (user.status === 'PENDING_VERIFICATION') user.status = 'ACTIVE';
    await user.save();
  }
  return { message: 'Verification email sent' };
}
