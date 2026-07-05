import { Router } from 'express';
import { success, parsePagination } from '../utils/apiResponse.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import * as buyerService from '../services/buyerService.js';

const router = Router();

router.use(requireAuth, requireRoles('BUYER'));

router.get('/', async (req, res) => {
  res.json(success(await buyerService.getBuyerProfile(req.user.id)));
});

router.get('/saved-listings', async (req, res) => {
  res.json(success(await buyerService.getSavedListings(req.user.id)));
});

router.post('/saved-listings/:listingId', async (req, res) => {
  const result = await buyerService.saveListing(req.user.id, req.params.listingId);
  res.status(201).json(success(result, result.message));
});

router.delete('/saved-listings/:listingId', async (req, res) => {
  const result = await buyerService.unsaveListing(req.user.id, req.params.listingId);
  res.json(success(result, result.message));
});

router.get('/checklists/:type', async (req, res) => {
  res.json(success(await buyerService.getChecklist(req.user.id, req.params.type, req.query.listingId)));
});

router.put('/checklists/:type/items', async (req, res) => {
  res.json(success(await buyerService.updateChecklistItems(
    req.user.id, req.params.type, req.query.listingId, req.body.checkedItems || req.body,
  )));
});

export default router;
