import { Router } from 'express';
import express from 'express';
import { success, parsePagination } from '../utils/apiResponse.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import * as paymentService from '../services/paymentService.js';

const router = Router();

router.post('/invoices', requireAuth, async (req, res) => {
  const invoice = await paymentService.createInvoice(req.user.id, req.body);
  res.status(201).json(success(invoice, 'Invoice created'));
});

router.get('/invoices/mine', requireAuth, async (req, res) => {
  res.json(success(await paymentService.getMyInvoices(req.user.id, parsePagination(req.query))));
});

router.get('/invoices/:id', requireAuth, async (req, res) => {
  res.json(success(await paymentService.getInvoice(req.user.id, req.params.id)));
});

router.post('/invoices/:id/pay', requireAuth, async (req, res) => {
  res.json(success(await paymentService.initiatePayment(req.user.id, req.params.id, req.body)));
});

router.get('/:id', requireAuth, async (req, res) => {
  res.json(success(await paymentService.getPayment(req.user.id, req.params.id)));
});

router.post('/reconcile', requireAuth, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  res.json(success(await paymentService.reconcile(req.user.id)));
});

export default router;

const webhookRouter = Router();

webhookRouter.post('/paynow', async (req, res) => {
  res.json(success(await paymentService.handlePaynowWebhook(req.body)));
});

webhookRouter.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  res.json(success(await paymentService.handleStripeWebhook(req.body, req.headers['stripe-signature'])));
});

export { webhookRouter };
