import { Router } from 'express';
import { success, parsePagination } from '../utils/apiResponse.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import * as adminService from '../services/adminService.js';
import * as trustService from '../services/trustService.js';
import * as paymentService from '../services/paymentService.js';
import * as userService from '../services/userService.js';

const router = Router();
const adminOnly = [requireAuth, requireRoles('ADMIN', 'SUPER_ADMIN')];

// Users
router.get('/users', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.listUsers(parsePagination(req.query), req.query)));
});

router.get('/users/:id', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.getUser(req.params.id)));
});

router.get('/users/:id/verification-status', ...adminOnly, async (req, res) => {
  res.json(success(await userService.getVerificationStatus(req.params.id)));
});

router.patch('/users/:id/status', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.updateUserStatus(req.params.id, req.body.status)));
});

router.put('/users/:id/status', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.updateUserStatus(req.params.id, req.body.status)));
});

router.patch('/users/:id/roles', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.updateUserRoles(req.params.id, req.body.roles)));
});

router.get('/users/:id/kyc/documents', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.listKycDocuments(req.params.id)));
});

router.get('/users/:userId/kyc/documents/:documentId/download', ...adminOnly, async (req, res) => {
  const { buffer, contentType, filename } = await adminService.downloadKycDocument(req.params.documentId);
  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

router.post('/users/:id/kyc/approve', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.approveKyc(req.params.id, req.user.id)));
});

router.post('/users/:id/kyc/reject', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.rejectKyc(req.params.id, req.user.id, req.body.reason)));
});

// Listings
router.get('/listings', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.listListings(parsePagination(req.query), req.query.status)));
});

router.get('/listings/:id', ...adminOnly, async (req, res) => {
  const { PropertyListing } = await import('../models/index.js');
  const listing = await PropertyListing.findById(req.params.id);
  res.json(success(listing));
});

router.post('/listings/:id/approve', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.approveListing(req.params.id)));
});

router.post('/listings/:id/reject', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.rejectListing(req.params.id, req.body.reason)));
});

router.post('/listings/:id/withdraw', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.withdrawListing(req.params.id)));
});

// Verifications
router.get('/verifications/queue', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.getVerificationQueue(parsePagination(req.query))));
});

router.get('/verifications/stats', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.getVerificationStats()));
});

// Payments
router.get('/payments/summary', ...adminOnly, async (req, res) => {
  res.json(success(await paymentService.getPaymentSummary()));
});

router.get('/payments/invoices', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.listInvoices(parsePagination(req.query))));
});

router.get('/payments/transactions', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.listPayments(parsePagination(req.query))));
});

router.get('/payments/reconciliation-runs', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.listReconciliationRuns(parsePagination(req.query))));
});

router.post('/payments/reconcile', ...adminOnly, async (req, res) => {
  res.json(success(await paymentService.reconcile(req.user.id)));
});

// Audit
router.get('/audit-logs', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.searchAuditLogs(parsePagination(req.query), req.query)));
});

// Analytics
router.get('/analytics/dashboard', ...adminOnly, async (req, res) => {
  res.json(success(await adminService.getDashboard()));
});

// Complaints
router.get('/complaints', ...adminOnly, async (req, res) => {
  res.json(success(await trustService.listComplaints(parsePagination(req.query), req.query.status)));
});

router.get('/complaints/stats', ...adminOnly, async (req, res) => {
  res.json(success(await trustService.getComplaintStats()));
});

router.patch('/complaints/:id', ...adminOnly, async (req, res) => {
  res.json(success(await trustService.updateComplaintStatus(req.params.id, req.body.status)));
});

// Referrals
router.get('/referrals', ...adminOnly, async (req, res) => {
  res.json(success(await trustService.listReferrals(parsePagination(req.query))));
});

router.get('/referrals/stats', ...adminOnly, async (req, res) => {
  const { ContactRequest } = await import('../models/index.js');
  const stats = await ContactRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  res.json(success(Object.fromEntries(stats.map((s) => [s._id, s.count]))));
});

router.patch('/referrals/:id', ...adminOnly, async (req, res) => {
  res.json(success(await trustService.updateReferralStatus(req.params.id, req.body.status)));
});

export default router;
