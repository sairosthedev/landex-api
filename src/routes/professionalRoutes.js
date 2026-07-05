import { Router } from 'express';
import { success, parsePagination } from '../utils/apiResponse.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import * as professionalService from '../services/professionalService.js';

const router = Router();

router.post('/register', requireAuth, requireRoles('AGENT', 'CONVEYANCER', 'LAWYER', 'SURVEYOR', 'ADMIN'), async (req, res) => {
  const profile = await professionalService.register(req.user.id, req.body);
  res.status(201).json(success(profile, 'Professional profile registered'));
});

router.get('/', async (req, res) => {
  res.json(success(await professionalService.search(req.query, parsePagination(req.query))));
});

router.get('/pending', requireAuth, requireRoles('ADMIN'), async (req, res) => {
  res.json(success(await professionalService.getPending(parsePagination(req.query))));
});

router.get('/me', requireAuth, async (req, res) => {
  res.json(success(await professionalService.getMyProfile(req.user.id)));
});

router.get('/contact-requests', requireAuth, requireRoles('AGENT', 'CONVEYANCER', 'LAWYER', 'SURVEYOR'), async (req, res) => {
  res.json(success(await professionalService.getContactRequests(req.user.id, parsePagination(req.query))));
});

router.get('/contact-requests/sent', requireAuth, async (req, res) => {
  res.json(success(await professionalService.getSentContactRequests(req.user.id, parsePagination(req.query))));
});

router.get('/:id', async (req, res) => {
  res.json(success(await professionalService.getById(req.params.id)));
});

router.post('/:id/approve', requireAuth, requireRoles('ADMIN'), async (req, res) => {
  res.json(success(await professionalService.approve(req.user.id, req.params.id)));
});

router.post('/:id/reject', requireAuth, requireRoles('ADMIN'), async (req, res) => {
  res.json(success(await professionalService.reject(req.user.id, req.params.id, req.body.reason)));
});

router.post('/contact-requests', requireAuth, async (req, res) => {
  const result = await professionalService.createContactRequest(req.user.id, req.body);
  res.status(201).json(success(result, 'Contact request sent'));
});

export default router;
