import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import config from '../config/index.js';
import { encryptPii, sha256 } from '../utils/crypto.js';
import {
  User,
  SellerProfile,
  BuyerProfile,
  PropertyListing,
  PropertyImage,
  UserKycStatus,
  FeeSchedule,
} from '../models/index.js';
import { DEFAULT_FEE_SCHEDULE } from '../constants/index.js';
import {
  DEMO_PASSWORD,
  DEMO_USERS,
  DEMO_LISTINGS,
  mapListingToDocument,
} from './seed-demo-data.js';

async function fetchImageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80';

async function upsertUser(definition, passwordHash) {
  const user = await User.findOneAndUpdate(
    { email: definition.email.toLowerCase() },
    {
      email: definition.email.toLowerCase(),
      phoneNumber: definition.phoneNumber,
      passwordHash,
      firstName: definition.firstName,
      lastName: definition.lastName,
      nationalIdEnc: encryptPii(`63-DEMO-${definition.phoneNumber.slice(-6)}A`),
      status: definition.status,
      emailVerified: true,
      phoneVerified: true,
      roles: definition.roles,
      deletedAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return user;
}

async function ensureSellerProfile(userId) {
  await SellerProfile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true },
  );
}

async function ensureBuyerProfile(userId) {
  await BuyerProfile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true },
  );
}

async function seedFees() {
  for (const fee of DEFAULT_FEE_SCHEDULE) {
    await FeeSchedule.findOneAndUpdate(
      { feeCode: fee.feeCode },
      { ...fee, active: true },
      { upsert: true },
    );
  }
}

async function replaceListingImages(listingId, sellerId, imageUrls) {
  await PropertyImage.updateMany({ listingId }, { active: false });

  for (let index = 0; index < imageUrls.length; index += 1) {
    const url = imageUrls[index];
    let buffer;
    let contentType;
    try {
      ({ buffer, contentType } = await fetchImageBuffer(url));
    } catch (err) {
      console.warn(`    ! image ${index + 1} failed (${err.message}); using fallback`);
      ({ buffer, contentType } = await fetchImageBuffer(FALLBACK_IMAGE));
    }
    const filename = `demo-${listingId}-${index + 1}.jpg`;
    const storageKey = `inline/listings/${listingId}/${filename}`;

    await PropertyImage.findOneAndUpdate(
      { listingId, storageKey },
      {
        listingId,
        storageKey,
        inlineData: buffer,
        originalFilename: filename,
        contentType,
        size: buffer.length,
        sha256: sha256(buffer),
        altText: `Listing photo ${index + 1}`,
        sortOrder: index,
        primary: index === 0,
        active: true,
        uploadedBy: sellerId,
      },
      { upsert: true, new: true },
    );
    console.log(`    ✓ image ${index + 1}/${imageUrls.length}`);
  }
}

async function seedDemo() {
  await connectDatabase();
  console.log('Seeding LandEx demo data...\n');

  await seedFees();
  console.log('✓ Fee schedules');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, config.auth.bcryptRounds);
  const usersByKey = new Map();

  for (const definition of DEMO_USERS) {
    const user = await upsertUser(definition, passwordHash);
    usersByKey.set(definition.key, user);
    console.log(`✓ user ${definition.email}`);

    if (definition.roles.includes('ROLE_SELLER') || definition.roles.includes('ROLE_AGENT')) {
      await ensureSellerProfile(user._id);
      await UserKycStatus.findOneAndUpdate(
        { userId: user._id },
        { status: 'APPROVED', reviewedAt: new Date() },
        { upsert: true },
      );
    }
    if (definition.roles.includes('ROLE_BUYER')) {
      await ensureBuyerProfile(user._id);
    }
  }

  console.log('\nSeeding listings with photos...');
  for (const listing of DEMO_LISTINGS) {
    const seller = usersByKey.get(listing.sellerKey);
    if (!seller) {
      throw new Error(`Missing seller for listing ${listing.reference}`);
    }

    const listingDoc = await PropertyListing.findOneAndUpdate(
      { listingReference: listing.reference },
      mapListingToDocument(listing, seller._id),
      { upsert: true, new: true },
    );

    console.log(`✓ ${listing.title}`);
    await replaceListingImages(listingDoc._id, seller._id, listing.images);
  }

  console.log('\nDemo seed complete.');
  console.log('\nSign-in accounts (password for all demo users):');
  console.log(`  ${DEMO_PASSWORD}`);
  for (const definition of DEMO_USERS) {
    console.log(`  - ${definition.email} (${definition.roles.join(', ')})`);
  }

  await disconnectDatabase();
}

seedDemo().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
