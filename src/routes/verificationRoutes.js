import { Router } from 'express';
import { success, parsePagination } from '../utils/apiResponse.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import * as verificationService from '../services/verificationService.js';
import { auditContextFromReq } from '../services/auditService.js';

const router = Router();
const submitterRoles = requireRoles('SELLER', 'AGENT', 'CONVEYANCER', 'ADMIN');
const reviewerRoles = requireRoles('VERIFICATION_OFFICER', 'ADMIN');

router.post('/', requireAuth, submitterRoles, async (req, res) => {
  const result = await verificationService.createRequest(req.user.id, req.body);
  res.status(201).json(success(result, 'Verification request created'));
});

router.get('/queue', requireAuth, reviewerRoles, async (req, res) => {
  res.json(success(await verificationService.getQueue(parsePagination(req.query))));
});

router.get('/mine', requireAuth, submitterRoles, async (req, res) => {
  res.json(success(await verificationService.getMyRequests(req.user.id, parsePagination(req.query))));
});

router.get('/:id', requireAuth, async (req, res) => {
  res.json(success(await verificationService.getById(req.user.id, req.params.id)));
});

router.post('/:id/submit', requireAuth, submitterRoles, async (req, res) => {
  res.json(success(await verificationService.submit(req.user.id, req.params.id)));
});

router.put('/:id/assign', requireAuth, reviewerRoles, async (req, res) => {
  res.json(success(await verificationService.assignReviewer(req.user.id, req.params.id, req.body.reviewerId)));
});

router.post('/:id/start-review', requireAuth, reviewerRoles, async (req, res) => {
  res.json(success(await verificationService.startReview(req.user.id, req.params.id)));
});

router.post('/:id/notes', requireAuth, async (req, res) => {
  res.json(success(await verificationService.addNote(req.user.id, req.params.id, req.body.note)));
});

router.post('/:id/review-documents', requireAuth, reviewerRoles, async (req, res) => {
  res.json(success(await verificationService.reviewDocuments(req.user.id, req.params.id, req.body.reviews)));
});

router.post('/:id/request-more-info', requireAuth, reviewerRoles, async (req, res) => {
  res.json(success(await verificationService.requestMoreInfo(req.user.id, req.params.id, req.body.reason)));
});

router.post('/:id/approve', requireAuth, reviewerRoles, async (req, res) => {
  res.json(success(await verificationService.approve(req.user.id, req.params.id, auditContextFromReq(req))));
});

router.post('/:id/reject', requireAuth, reviewerRoles, async (req, res) => {
  res.json(success(await verificationService.reject(req.user.id, req.params.id, req.body.reason, auditContextFromReq(req))));
});

export default router;
