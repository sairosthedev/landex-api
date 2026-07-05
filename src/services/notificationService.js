import { Notification, NotificationPreference } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { pageResponse } from '../utils/apiResponse.js';

const DEFAULT_EVENT_TYPES = [
  'USER_REGISTERED', 'LISTING_PUBLISHED', 'ENQUIRY_RECEIVED',
  'PAYMENT_COMPLETED', 'VERIFICATION_UPDATED', 'KYC_UPDATED',
];

function toNotificationResponse(n) {
  return {
    id: n._id.toString(),
    channel: n.channel,
    status: n.status,
    subject: n.subject,
    body: n.body,
    templateCode: n.templateCode,
    sentAt: n.sentAt,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}

export async function listInbox(userId, unreadOnly, pagination) {
  const { page, size, skip } = pagination;
  const filter = { recipientId: userId, channel: 'IN_APP' };
  if (unreadOnly) filter.readAt = null;

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
    Notification.countDocuments(filter),
  ]);
  return pageResponse(items.map(toNotificationResponse), page, size, total);
}

export async function getUnreadCount(userId) {
  const count = await Notification.countDocuments({
    recipientId: userId,
    channel: 'IN_APP',
    readAt: null,
  });
  return { count };
}

export async function markAsRead(userId, notificationId) {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipientId: userId,
    channel: 'IN_APP',
  });
  if (!notification) throw AppError.notFound('Notification not found');
  notification.readAt = new Date();
  await notification.save();
  return toNotificationResponse(notification);
}

export async function markAllAsRead(userId) {
  await Notification.updateMany(
    { recipientId: userId, channel: 'IN_APP', readAt: null },
    { readAt: new Date() },
  );
}

export async function getPreferences(userId) {
  const prefs = await NotificationPreference.find({ userId });
  if (prefs.length === 0) {
    return DEFAULT_EVENT_TYPES.flatMap((eventType) => [
      { eventType, channel: 'EMAIL', enabled: true },
      { eventType, channel: 'IN_APP', enabled: true },
    ]);
  }
  return prefs.map((p) => ({
    eventType: p.eventType,
    channel: p.channel,
    enabled: p.enabled,
  }));
}

export async function updatePreference(userId, data) {
  const pref = await NotificationPreference.findOneAndUpdate(
    { userId, eventType: data.eventType, channel: data.channel },
    { enabled: data.enabled },
    { upsert: true, new: true },
  );
  return {
    eventType: pref.eventType,
    channel: pref.channel,
    enabled: pref.enabled,
  };
}
