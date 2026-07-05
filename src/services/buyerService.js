import {
  BuyerProfile, SavedListing, ChecklistProgress, PropertyListing,
} from '../models/index.js';
import { AppError } from '../utils/errors.js';
import * as listingService from './listingService.js';

async function ensureBuyerProfile(userId) {
  let profile = await BuyerProfile.findOne({ userId });
  if (!profile) {
    profile = await BuyerProfile.create({ userId });
  }
  return profile;
}

export async function getBuyerProfile(userId) {
  const profile = await ensureBuyerProfile(userId);
  return {
    userId: profile.userId.toString(),
    verificationStatus: profile.verificationStatus,
    financingStatus: profile.financingStatus,
    preferredCurrency: profile.preferredCurrency,
    totalEnquiries: profile.totalEnquiries,
  };
}

export async function getSavedListings(userId) {
  const saved = await SavedListing.find({ userId }).sort({ savedAt: -1 });
  const listings = await Promise.all(
    saved.map(async (s) => {
      try {
        return await listingService.getListing(s.listingId.toString(), userId, false);
      } catch {
        return null;
      }
    }),
  );
  return listings.filter(Boolean);
}

export async function saveListing(userId, listingId) {
  const listing = await PropertyListing.findOne({ _id: listingId, status: 'ACTIVE', deletedAt: null });
  if (!listing) throw AppError.notFound('Listing not found');
  await SavedListing.findOneAndUpdate(
    { userId, listingId },
    { savedAt: new Date() },
    { upsert: true },
  );
  return { message: 'Listing saved successfully' };
}

export async function unsaveListing(userId, listingId) {
  await SavedListing.deleteOne({ userId, listingId });
  return { message: 'Listing removed from saved list' };
}

export async function getChecklist(userId, checklistType, listingId) {
  const filter = { userId, checklistType };
  if (listingId) filter.listingId = listingId;
  let progress = await ChecklistProgress.findOne(filter);
  if (!progress) {
    progress = await ChecklistProgress.create({ userId, checklistType, listingId, checkedItems: {} });
  }
  const checkedItems = Object.fromEntries(progress.checkedItems || []);
  return { checklistType, listingId: progress.listingId?.toString(), checkedItems };
}

export async function updateChecklistItems(userId, checklistType, listingId, items) {
  const filter = { userId, checklistType };
  if (listingId) filter.listingId = listingId;
  const progress = await ChecklistProgress.findOneAndUpdate(
    filter,
    { $set: { checkedItems: items } },
    { upsert: true, new: true },
  );
  return {
    checklistType,
    listingId: progress.listingId?.toString(),
    checkedItems: Object.fromEntries(progress.checkedItems || []),
  };
}
