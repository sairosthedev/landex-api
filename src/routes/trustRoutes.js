import { Router } from 'express';
import { success } from '../utils/apiResponse.js';
import * as trustService from '../services/trustService.js';

const router = Router();

router.post('/complaints', async (req, res) => {
  const result = await trustService.submitComplaint(req.body);
  res.status(201).json(success(result, result.message));
});

router.post('/contact/inquiries', async (req, res) => {
  const result = await trustService.submitContactInquiry(req.body);
  res.status(201).json(success(result, result.message));
});

export default router;
