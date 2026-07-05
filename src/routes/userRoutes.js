import { Router } from 'express';
import { success } from '../utils/apiResponse.js';
import { requireAuth } from '../middleware/auth.js';
import { kycUpload } from '../middleware/upload.js';
import * as userService from '../services/userService.js';

const router = Router();

router.use(requireAuth);

router.get('/me', async (req, res) => {
  res.json(success(await userService.getProfile(req.user.id)));
});

router.put('/me', async (req, res) => {
  const profile = await userService.updateProfile(req.user.id, req.body);
  res.json(success(profile, 'Profile updated successfully'));
});

router.post('/me/deactivate', async (req, res) => {
  const result = await userService.deactivateAccount(req.user.id, req.body?.reason);
  res.json(success(result, result.message));
});

router.post('/me/kyc/documents', kycUpload.single('file'), async (req, res) => {
  const doc = await userService.uploadKycDocument(req.user.id, req.query.documentType || req.body.documentType, req.file);
  res.status(201).json(success(doc, 'KYC document uploaded successfully'));
});

router.get('/me/kyc/documents', async (req, res) => {
  res.json(success(await userService.listKycDocuments(req.user.id)));
});

router.get('/me/verification-status', async (req, res) => {
  res.json(success(await userService.getVerificationStatus(req.user.id)));
});

export default router;
