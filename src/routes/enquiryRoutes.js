import { Router } from 'express';
import { success, parsePagination } from '../utils/apiResponse.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import * as enquiryService from '../services/enquiryService.js';

const router = Router();

router.post('/', requireAuth, requireRoles('BUYER'), async (req, res) => {
  const enquiry = await enquiryService.createEnquiry(req.user.id, req.body);
  res.status(201).json(success(enquiry, 'Enquiry created successfully'));
});

router.get('/mine', requireAuth, requireRoles('BUYER'), async (req, res) => {
  res.json(success(await enquiryService.getMyEnquiries(req.user.id, parsePagination(req.query))));
});

router.get('/inbox', requireAuth, requireRoles('SELLER', 'AGENT', 'ADMIN'), async (req, res) => {
  res.json(success(await enquiryService.getInbox(req.user.id, parsePagination(req.query))));
});

router.get('/:id', requireAuth, async (req, res) => {
  res.json(success(await enquiryService.getEnquiry(req.user.id, req.params.id)));
});

router.post('/:id/respond', requireAuth, requireRoles('SELLER', 'AGENT', 'ADMIN'), async (req, res) => {
  res.json(success(await enquiryService.respond(req.user.id, req.params.id, req.body.message)));
});

router.post('/:id/messages', requireAuth, requireRoles('BUYER'), async (req, res) => {
  res.json(success(await enquiryService.addMessage(req.user.id, req.params.id, req.body.message)));
});

router.post('/:id/close', requireAuth, async (req, res) => {
  const result = await enquiryService.closeEnquiry(req.user.id, req.params.id);
  res.json(success(result, result.message));
});

export default router;
