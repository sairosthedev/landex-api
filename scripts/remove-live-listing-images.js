/**
 * Soft-delete (deactivate) all property images for live (ACTIVE) listings.
 * Usage: node scripts/remove-live-listing-images.js
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { PropertyListing, PropertyImage } from '../src/models/index.js';

async function main() {
  await connectDatabase();

  const liveListings = await PropertyListing.find({
    status: 'ACTIVE',
    deletedAt: null,
  }).select('_id listingReference title');

  const listingIds = liveListings.map((listing) => listing._id);

  if (!listingIds.length) {
    console.log('No live listings found.');
    await disconnectDatabase();
    return;
  }

  const result = await PropertyImage.updateMany(
    { listingId: { $in: listingIds }, active: true },
    { active: false },
  );

  console.log(`Deactivated ${result.modifiedCount} image(s) across ${liveListings.length} live listing(s):`);
  for (const listing of liveListings) {
    console.log(`  - ${listing.listingReference ?? listing._id} · ${listing.title}`);
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error('Failed to remove live listing images:', err);
  process.exit(1);
});
