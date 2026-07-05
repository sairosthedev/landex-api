import {
  PropertyListing, SellerProfile, PropertyImage,
} from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { generateReference } from '../utils/referenceGenerator.js';
import { pageResponse, resolveSortField } from '../utils/apiResponse.js';

const SORT_ALIASES = { price: 'askingPrice', size: 'areaSqm' };

function imageContentUrl(imageId) {
  return `/api/v1/listing-images/${imageId}/content`;
}

function mapImageResponse(img) {
  const id = img._id?.toString() ?? img.id;
  return {
    id,
    url: imageContentUrl(id),
    originalFilename: img.originalFilename,
    contentType: img.contentType,
    altText: img.altText,
    sortOrder: img.sortOrder,
    primary: img.primary,
  };
}

function normalizeListingInput(data) {
  const normalized = { ...data };
  if (data.coordinates?.latitude != null && data.coordinates?.longitude != null) {
    normalized.latitude = data.coordinates.latitude;
    normalized.longitude = data.coordinates.longitude;
  }
  if (data.size != null && normalized.areaSqm == null) {
    normalized.areaSqm = data.size;
  }
  if (data.price != null && normalized.askingPrice == null) {
    normalized.askingPrice = data.price;
  }
  return normalized;
}

function toListingResponse(listing, images = null) {
  const response = {
    id: listing._id.toString(),
    listingReference: listing.listingReference,
    sellerId: listing.sellerId?.toString(),
    listingType: listing.listingType,
    status: listing.status,
    title: listing.title,
    description: listing.description,
    askingPrice: listing.askingPrice,
    price: listing.askingPrice,
    currency: listing.currency,
    priceNegotiable: listing.priceNegotiable,
    propertyType: listing.propertyType,
    tenureType: listing.tenureType,
    areaSqm: listing.areaSqm,
    size: listing.areaSqm,
    sizeUnit: 'SQM',
    province: listing.province,
    district: listing.district,
    ward: listing.ward,
    locality: listing.locality,
    address: listing.address,
    titleNumber: listing.titleNumber,
    parcelNumber: listing.parcelNumber,
    standNumber: listing.standNumber,
    erfNumber: listing.erfNumber,
    latitude: listing.latitude,
    longitude: listing.longitude,
    coordinates: listing.latitude != null && listing.longitude != null
      ? { latitude: listing.latitude, longitude: listing.longitude }
      : undefined,
    featured: listing.featured,
    verified: listing.verified,
    viewCount: listing.viewCount,
    publishedAt: listing.publishedAt,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
  if (images) {
    response.images = images.map(mapImageResponse);
  }
  return response;
}

async function attachListingImages(listings) {
  if (!listings.length) return [];
  const ids = listings.map((l) => l._id);
  const images = await PropertyImage.find({ listingId: { $in: ids }, active: true }).sort({ sortOrder: 1 });
  const byListing = new Map();
  for (const img of images) {
    const lid = img.listingId.toString();
    if (!byListing.has(lid)) byListing.set(lid, []);
    byListing.get(lid).push(img);
  }
  return listings.map((l) => toListingResponse(l, byListing.get(l._id.toString()) ?? []));
}

async function ensureSellerProfile(userId) {
  let profile = await SellerProfile.findOne({ userId });
  if (!profile) {
    profile = await SellerProfile.create({ userId });
  }
  return profile;
}

export async function createListing(userId, data) {
  await ensureSellerProfile(userId);
  const input = normalizeListingInput(data);

  const listingData = {
    listingReference: generateReference('listing'),
    sellerId: userId,
    listingType: input.listingType,
    status: 'DRAFT',
    title: input.title,
    description: input.description,
    askingPrice: input.askingPrice,
    currency: input.currency || 'USD',
    priceNegotiable: input.priceNegotiable ?? false,
    propertyType: input.propertyType,
    tenureType: input.tenureType,
    areaSqm: input.areaSqm,
    province: input.province,
    district: input.district,
    ward: input.ward,
    locality: input.locality,
    address: input.address,
    titleNumber: input.titleNumber,
    parcelNumber: input.parcelNumber,
    standNumber: input.standNumber,
    erfNumber: input.erfNumber,
    latitude: input.latitude,
    longitude: input.longitude,
  };

  if (input.latitude != null && input.longitude != null) {
    listingData.location = { type: 'Point', coordinates: [input.longitude, input.latitude] };
  }

  const listing = await PropertyListing.create(listingData);

  return toListingResponse(listing, []);
}

export async function updateListing(userId, listingId, data) {
  const listing = await PropertyListing.findOne({ _id: listingId, deletedAt: null });
  if (!listing) throw AppError.notFound('Listing not found');
  if (listing.sellerId.toString() !== userId) {
    throw AppError.notFound('Listing not found or access denied');
  }

  const input = normalizeListingInput(data);
  const fields = [
    'title', 'description', 'listingType', 'propertyType', 'tenureType', 'areaSqm',
    'province', 'district', 'ward', 'locality', 'address', 'titleNumber', 'parcelNumber',
    'standNumber', 'erfNumber', 'currency', 'priceNegotiable', 'featured',
  ];
  for (const f of fields) {
    if (input[f] !== undefined) listing[f] = input[f];
  }
  if (input.askingPrice !== undefined) listing.askingPrice = input.askingPrice;
  if (input.latitude != null && input.longitude != null) {
    listing.latitude = input.latitude;
    listing.longitude = input.longitude;
    listing.location = { type: 'Point', coordinates: [input.longitude, input.latitude] };
  }
  if (input.status) {
    listing.status = input.status;
    if (input.status === 'ACTIVE' && !listing.publishedAt) {
      listing.publishedAt = new Date();
    }
  }

  await listing.save();
  const images = await PropertyImage.find({ listingId, active: true }).sort({ sortOrder: 1 });
  return toListingResponse(listing, images);
}

export async function deleteListing(userId, listingId) {
  const listing = await PropertyListing.findOne({ _id: listingId, deletedAt: null });
  if (!listing || listing.sellerId.toString() !== userId) {
    throw AppError.notFound('Listing not found or access denied');
  }
  listing.status = 'WITHDRAWN';
  listing.deletedAt = new Date();
  await listing.save();
  return { message: 'Listing deleted successfully' };
}

export async function searchListings(criteria, pagination) {
  const { page, size, sortBy, sortDir, skip } = pagination;
  const filter = { status: 'ACTIVE', deletedAt: null };

  if (criteria.province) filter.province = new RegExp(criteria.province, 'i');
  if (criteria.district) filter.district = new RegExp(criteria.district, 'i');
  if (criteria.propertyType) filter.propertyType = criteria.propertyType;
  if (criteria.tenureType) filter.tenureType = criteria.tenureType;
  if (criteria.listingType) filter.listingType = criteria.listingType;
  if (criteria.minPrice) filter.askingPrice = { ...filter.askingPrice, $gte: criteria.minPrice };
  if (criteria.maxPrice) filter.askingPrice = { ...filter.askingPrice, $lte: criteria.maxPrice };
  if (criteria.keyword) {
    filter.$or = [
      { title: new RegExp(criteria.keyword, 'i') },
      { description: new RegExp(criteria.keyword, 'i') },
      { address: new RegExp(criteria.keyword, 'i') },
    ];
  }

  if (criteria.lat && criteria.lng && criteria.radiusKm) {
    filter.location = {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [criteria.lng, criteria.lat] },
        $maxDistance: criteria.radiusKm * 1000,
      },
    };
  } else if (criteria.minLat && criteria.minLng && criteria.maxLat && criteria.maxLng) {
    filter.location = {
      $geoWithin: {
        $box: [
          [criteria.minLng, criteria.minLat],
          [criteria.maxLng, criteria.maxLat],
        ],
      },
    };
  }

  const sortField = resolveSortField(sortBy, SORT_ALIASES);
  const [items, total] = await Promise.all([
    PropertyListing.find(filter).sort({ [sortField]: sortDir }).skip(skip).limit(size),
    PropertyListing.countDocuments(filter),
  ]);

  const content = await attachListingImages(items);
  return pageResponse(content, page, size, total);
}

export async function getMyListings(userId, status, pagination) {
  const { page, size, sortBy, sortDir, skip } = pagination;
  const filter = { sellerId: userId, deletedAt: null };
  if (status) filter.status = status;

  const sortField = resolveSortField(sortBy, SORT_ALIASES);
  const [items, total] = await Promise.all([
    PropertyListing.find(filter).sort({ [sortField]: sortDir }).skip(skip).limit(size),
    PropertyListing.countDocuments(filter),
  ]);

  const content = await attachListingImages(items);
  return pageResponse(content, page, size, total);
}

export async function getListing(listingId, userId, incrementView) {
  const listing = await PropertyListing.findOne({ _id: listingId, deletedAt: null });
  if (!listing) throw AppError.notFound('Listing not found');

  const isOwner = userId && listing.sellerId.toString() === userId;
  if (!isOwner && listing.status !== 'ACTIVE') {
    throw AppError.notFound('Listing not found');
  }

  if (incrementView && !isOwner && listing.status === 'ACTIVE') {
    listing.viewCount += 1;
    await listing.save();
  }

  const images = await PropertyImage.find({ listingId, active: true }).sort({ sortOrder: 1 });
  return toListingResponse(listing, images);
}

export async function uploadListingImage(userId, listingId, file, altText) {
  const listing = await PropertyListing.findOne({ _id: listingId, deletedAt: null });
  if (!listing) throw AppError.notFound('Listing not found');

  const { objectStorage } = await import('./storageService.js');
  const key = `listings/${listingId}/${Date.now()}-${file.originalname}`;
  const { storageKey, checksum } = await objectStorage.upload(key, file.buffer, file.mimetype);

  const count = await PropertyImage.countDocuments({ listingId, active: true });
  const image = await PropertyImage.create({
    listingId,
    storageKey,
    originalFilename: file.originalname,
    contentType: file.mimetype,
    size: file.size,
    sha256: checksum,
    altText,
    sortOrder: count,
    primary: count === 0,
    uploadedBy: userId,
  });

  return {
    id: image._id.toString(),
    listingId: listingId.toString(),
    url: imageContentUrl(image._id.toString()),
    originalFilename: image.originalFilename,
    contentType: image.contentType,
    sortOrder: image.sortOrder,
    primary: image.primary,
  };
}

export async function listListingImages(listingId) {
  const images = await PropertyImage.find({ listingId, active: true }).sort({ sortOrder: 1 });
  return images.map(mapImageResponse);
}

export async function getImageContent(imageId) {
  const image = await PropertyImage.findOne({ _id: imageId, active: true });
  if (!image) throw AppError.notFound('Image not found');
  const { objectStorage } = await import('./storageService.js');
  const buffer = await objectStorage.download(image.storageKey);
  return { buffer, contentType: image.contentType, filename: image.originalFilename };
}
