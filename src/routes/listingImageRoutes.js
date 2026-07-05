import { Router } from 'express';
import { success } from '../utils/apiResponse.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import * as listingService from '../services/listingService.js';

const router = Router();

router.post('/listings/:listingId/images', requireAuth, requireRoles('SELLER', 'AGENT', 'ADMIN'), imageUpload.single('file'), async (req, res) => {
  const image = await listingService.uploadListingImage(req.user.id, req.params.listingId, req.file, req.body?.altText);
  res.status(201).json(success(image, 'Image uploaded successfully'));
});

router.get('/listings/:listingId/images', async (req, res) => {
  res.json(success(await listingService.listListingImages(req.params.listingId)));
});

router.get('/listing-images/:imageId/content', async (req, res) => {
  const { buffer, contentType, filename } = await listingService.getImageContent(req.params.imageId);
  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `inline; filename="${filename}"`);
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  res.send(buffer);
});

export default router;
