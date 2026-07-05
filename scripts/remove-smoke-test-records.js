/**
 * Remove automated smoke-test data from MongoDB.
 * Keeps demo seed accounts (admin@landex.local, *.landex.demo) and LST-DEMO-* listings.
 *
 * Usage: node scripts/remove-smoke-test-records.js
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import {
  User,
  RefreshToken,
  PasswordResetToken,
  EmailVerificationToken,
  LoginAttempt,
  KycDocument,
  UserKycStatus,
  SellerProfile,
  BuyerProfile,
  SavedListing,
  ChecklistProgress,
  PropertyListing,
  PropertyImage,
  PropertyDocument,
  DocumentAccessLog,
  VerificationRequest,
  VerificationDocument,
  VerificationReview,
  VerificationStatusHistory,
  Enquiry,
  EnquiryMessage,
  ContactRequest,
  Invoice,
  Payment,
  Notification,
  NotificationPreference,
  Complaint,
  ContactInquiry,
} from '../src/models/index.js';

const SMOKE_USER_QUERY = {
  $or: [
    { email: /@test\.landex\.local$/i },
    { email: /^smoke_/i },
    {
      firstName: { $in: ['Smoke', 'SmokeUpdated'] },
      lastName: { $in: ['SELLER', 'BUYER'] },
    },
  ],
};

const SMOKE_LISTING_QUERY = {
  $or: [
    { title: /^Smoke Stand / },
    { description: 'Automated smoke test listing' },
  ],
};

const SMOKE_COMPLAINT_QUERY = {
  $or: [
    { subject: 'Smoke test complaint' },
    { description: /Automated smoke test/i },
    { reporterEmail: /@test\.com$/i },
  ],
};

const SMOKE_CONTACT_QUERY = {
  $or: [
    { name: 'Smoke Tester' },
    { message: /Smoke test/i },
    { email: /^(reporter_|contact_).*@test\.com$/i },
  ],
};

async function count(label, promise) {
  const result = await promise;
  const n = result.deletedCount ?? result.modifiedCount ?? 0;
  if (n > 0) console.log(`  ✓ ${label}: ${n}`);
  return n;
}

async function removeForListings(listingIds) {
  if (!listingIds.length) return 0;

  let total = 0;
  const enquiries = await Enquiry.find({ listingId: { $in: listingIds } }).select('_id');
  const enquiryIds = enquiries.map((row) => row._id);

  if (enquiryIds.length) {
    total += await count('enquiry messages', EnquiryMessage.deleteMany({ enquiryId: { $in: enquiryIds } }));
    total += await count('enquiries', Enquiry.deleteMany({ _id: { $in: enquiryIds } }));
  }

  const verificationRequests = await VerificationRequest.find({ listingId: { $in: listingIds } }).select('_id');
  const verificationIds = verificationRequests.map((row) => row._id);

  if (verificationIds.length) {
    total += await count('verification documents', VerificationDocument.deleteMany({ verificationRequestId: { $in: verificationIds } }));
    total += await count('verification reviews', VerificationReview.deleteMany({ verificationRequestId: { $in: verificationIds } }));
    total += await count('verification history', VerificationStatusHistory.deleteMany({ verificationRequestId: { $in: verificationIds } }));
    total += await count('verification requests', VerificationRequest.deleteMany({ _id: { $in: verificationIds } }));
  }

  const propertyDocs = await PropertyDocument.find({ listingId: { $in: listingIds } }).select('_id');
  const propertyDocIds = propertyDocs.map((row) => row._id);
  if (propertyDocIds.length) {
    total += await count('document access logs', DocumentAccessLog.deleteMany({ documentId: { $in: propertyDocIds } }));
  }

  total += await count('saved listings', SavedListing.deleteMany({ listingId: { $in: listingIds } }));
  total += await count('checklist progress', ChecklistProgress.deleteMany({ listingId: { $in: listingIds } }));
  total += await count('listing images', PropertyImage.deleteMany({ listingId: { $in: listingIds } }));
  total += await count('listing documents', PropertyDocument.deleteMany({ listingId: { $in: listingIds } }));
  total += await count('contact requests', ContactRequest.deleteMany({ listingId: { $in: listingIds } }));
  total += await count('invoices', Invoice.deleteMany({ referenceId: { $in: listingIds } }));
  total += await count('listings', PropertyListing.deleteMany({ _id: { $in: listingIds } }));

  return total;
}

async function removeForUsers(smokeUsers) {
  const userIds = smokeUsers.map((row) => row._id);
  if (!userIds.length) return 0;

  let total = 0;
  total += await count('refresh tokens', RefreshToken.deleteMany({ userId: { $in: userIds } }));
  total += await count('password reset tokens', PasswordResetToken.deleteMany({ userId: { $in: userIds } }));
  total += await count('email verification tokens', EmailVerificationToken.deleteMany({ userId: { $in: userIds } }));
  total += await count('KYC documents', KycDocument.deleteMany({ userId: { $in: userIds } }));
  total += await count('KYC status', UserKycStatus.deleteMany({ userId: { $in: userIds } }));
  total += await count('seller profiles', SellerProfile.deleteMany({ userId: { $in: userIds } }));
  total += await count('buyer profiles', BuyerProfile.deleteMany({ userId: { $in: userIds } }));
  total += await count('saved listings (user)', SavedListing.deleteMany({ userId: { $in: userIds } }));
  total += await count('checklist progress (user)', ChecklistProgress.deleteMany({ userId: { $in: userIds } }));
  total += await count('notifications', Notification.deleteMany({ userId: { $in: userIds } }));
  total += await count('notification preferences', NotificationPreference.deleteMany({ userId: { $in: userIds } }));
  total += await count('contact requests (requester)', ContactRequest.deleteMany({ requesterId: { $in: userIds } }));

  const userEnquiries = await Enquiry.find({
    $or: [{ buyerId: { $in: userIds } }, { sellerId: { $in: userIds } }],
  }).select('_id');
  const userEnquiryIds = userEnquiries.map((row) => row._id);
  if (userEnquiryIds.length) {
    total += await count('enquiry messages (user)', EnquiryMessage.deleteMany({ enquiryId: { $in: userEnquiryIds } }));
    total += await count('enquiries (buyer/seller)', Enquiry.deleteMany({ _id: { $in: userEnquiryIds } }));
  }

  const userVerifications = await VerificationRequest.find({
    $or: [{ sellerId: { $in: userIds } }, { requestedBy: { $in: userIds } }],
  }).select('_id');
  const userVerificationIds = userVerifications.map((row) => row._id);
  if (userVerificationIds.length) {
    total += await count('verification documents (user)', VerificationDocument.deleteMany({ verificationRequestId: { $in: userVerificationIds } }));
    total += await count('verification reviews (user)', VerificationReview.deleteMany({ verificationRequestId: { $in: userVerificationIds } }));
    total += await count('verification history (user)', VerificationStatusHistory.deleteMany({ verificationRequestId: { $in: userVerificationIds } }));
    total += await count('verification requests (seller)', VerificationRequest.deleteMany({ _id: { $in: userVerificationIds } }));
  }
  total += await count('invoices (customer)', Invoice.deleteMany({ payerId: { $in: userIds } }));
  total += await count('payments', Payment.deleteMany({ payerId: { $in: userIds } }));

  const smokeEmails = smokeUsers.map((user) => user.email);
  if (smokeEmails.length) {
    total += await count('login attempts', LoginAttempt.deleteMany({ email: { $in: smokeEmails } }));
  }

  total += await count('users', User.deleteMany({ _id: { $in: userIds } }));

  return total;
}

async function main() {
  await connectDatabase();
  console.log('Removing smoke-test records...\n');

  const smokeUsers = await User.find(SMOKE_USER_QUERY).select('_id email firstName lastName');
  const smokeListings = await PropertyListing.find(SMOKE_LISTING_QUERY).select('_id title listingReference sellerId');
  const smokeUserIds = smokeUsers.map((row) => row._id);
  const smokeListingIds = smokeListings.map((row) => row._id);

  console.log(`Found ${smokeUsers.length} smoke user(s):`);
  for (const user of smokeUsers) {
    console.log(`  - ${user.email}`);
  }

  console.log(`\nFound ${smokeListings.length} smoke listing(s):`);
  for (const listing of smokeListings) {
    console.log(`  - ${listing.listingReference ?? listing._id} · ${listing.title}`);
  }

  let removed = 0;
  removed += await removeForListings(smokeListingIds);
  removed += await removeForUsers(smokeUsers);
  removed += await count('complaints', Complaint.deleteMany(SMOKE_COMPLAINT_QUERY));
  removed += await count('contact inquiries', ContactInquiry.deleteMany(SMOKE_CONTACT_QUERY));

  // Catch orphan smoke enquiries/messages by subject
  const orphanEnquiries = await Enquiry.find({ subject: 'Smoke enquiry' }).select('_id');
  if (orphanEnquiries.length) {
    const orphanIds = orphanEnquiries.map((row) => row._id);
    removed += await count('orphan enquiry messages', EnquiryMessage.deleteMany({ enquiryId: { $in: orphanIds } }));
    removed += await count('orphan enquiries', Enquiry.deleteMany({ _id: { $in: orphanIds } }));
  }

  console.log(`\nDone — ${removed} related record(s) removed.`);
  console.log('Demo accounts (*.landex.demo, admin@landex.local) and LST-DEMO-* listings were kept.\n');

  await disconnectDatabase();
}

main().catch((err) => {
  console.error('Smoke cleanup failed:', err);
  process.exit(1);
});
