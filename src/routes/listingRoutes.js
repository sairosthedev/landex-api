import { Router } from 'express';
import { success, parsePagination } from '../utils/apiResponse.js';
import { requireAuth, requireRoles, optionalAuth } from '../middleware/auth.js';
import * as listingService from '../services/listingService.js';

const router = Router();

router.post('/', requireAuth, requireRoles('SELLER', 'ADMIN'), async (req, res) => {
  const listing = await listingService.createListing(req.user.id, req.body);
  res.status(201).json(success(listing, 'Listing created successfully'));
});

router.put('/:id', requireAuth, requireRoles('SELLER', 'ADMIN'), async (req, res) => {
  const listing = await listingService.updateListing(req.user.id, req.params.id, req.body);
  res.json(success(listing, 'Listing updated successfully'));
});

router.delete('/:id', requireAuth, requireRoles('SELLER', 'ADMIN'), async (req, res) => {
  const result = await listingService.deleteListing(req.user.id, req.params.id);
  res.json(success(result, result.message));
});

router.get('/', optionalAuth, async (req, res) => {
  const pagination = parsePagination(req.query);
  const criteria = { ...req.query };
  if (criteria.minPrice) criteria.minPrice = parseFloat(criteria.minPrice);
  if (criteria.maxPrice) criteria.maxPrice = parseFloat(criteria.maxPrice);
  if (criteria.lat) criteria.lat = parseFloat(criteria.lat);
  if (criteria.lng) criteria.lng = parseFloat(criteria.lng);
  if (criteria.radiusKm) criteria.radiusKm = parseFloat(criteria.radiusKm);
  res.json(success(await listingService.searchListings(criteria, pagination)));
});

router.get('/mine', requireAuth, requireRoles('SELLER', 'ADMIN'), async (req, res) => {
  const pagination = parsePagination(req.query);
  res.json(success(await listingService.getMyListings(req.user.id, req.query.status, pagination)));
});

router.get('/:id', optionalAuth, async (req, res) => {
  const listing = await listingService.getListing(req.params.id, req.user?.id, true);
  res.json(success(listing));
});

export default router;
