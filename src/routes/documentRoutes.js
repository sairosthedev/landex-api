import { Router } from 'express';
import { success, parsePagination } from '../utils/apiResponse.js';
import { requireAuth, requireRoles, resolveClientIp } from '../middleware/auth.js';
import { documentUpload } from '../middleware/upload.js';
import * as documentService from '../services/documentService.js';

const router = Router();
const docRoles = requireRoles('SELLER', 'AGENT', 'CONVEYANCER', 'ADMIN');

router.post('/listings/:listingId/title-deed', requireAuth, docRoles, documentUpload.single('file'), async (req, res) => {
  const doc = await documentService.uploadTitleDeed(req.user.id, req.params.listingId, req.file);
  res.status(201).json(success(doc, 'Title deed uploaded'));
});

router.post('/listings/:listingId/survey-diagram', requireAuth, docRoles, documentUpload.single('file'), async (req, res) => {
  const doc = await documentService.uploadSurveyDiagram(req.user.id, req.params.listingId, req.file);
  res.status(201).json(success(doc, 'Survey diagram uploaded'));
});

router.post('/listings/:listingId/supporting', requireAuth, docRoles, documentUpload.single('file'), async (req, res) => {
  const doc = await documentService.uploadSupporting(req.user.id, req.params.listingId, req.file);
  res.status(201).json(success(doc, 'Supporting document uploaded'));
});

router.post('/seller/id-copy', requireAuth, docRoles, documentUpload.single('file'), async (req, res) => {
  const doc = await documentService.uploadSellerIdCopy(req.user.id, req.file);
  res.status(201).json(success(doc, 'ID copy uploaded'));
});

router.post('/listings/:listingId', requireAuth, docRoles, documentUpload.single('file'), async (req, res) => {
  const doc = await documentService.uploadGeneric(req.user.id, req.params.listingId, req.body.documentType || 'OTHER', req.file);
  res.status(201).json(success(doc, 'Document uploaded'));
});

router.get('/:id', requireAuth, async (req, res) => {
  res.json(success(await documentService.getDocument(req.user.id, req.params.id)));
});

router.get('/', requireAuth, async (req, res) => {
  const pagination = parsePagination(req.query);
  const page = await documentService.listDocuments(req.user.id, req.query, pagination);
  res.json(success(page));
});

router.get('/:id/download', requireAuth, async (req, res) => {
  const { buffer, contentType, filename } = await documentService.downloadDocument(req.user.id, req.params.id, resolveClientIp(req));
  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

router.get('/:id/presigned-url', requireAuth, async (req, res) => {
  res.json(success(await documentService.getPresignedUrl(req.user.id, req.params.id)));
});

router.delete('/:id', requireAuth, docRoles, async (req, res) => {
  const result = await documentService.deleteDocument(req.user.id, req.params.id);
  res.json(success(result, result.message));
});

export default router;
