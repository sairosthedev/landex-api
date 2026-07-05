import { Router } from 'express';
import { success, parsePagination } from '../utils/apiResponse.js';
import { requireAuth } from '../middleware/auth.js';
import * as notificationService from '../services/notificationService.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const unreadOnly = req.query.unreadOnly === 'true';
  res.json(success(await notificationService.listInbox(req.user.id, unreadOnly, parsePagination(req.query))));
});

router.get('/unread-count', async (req, res) => {
  res.json(success(await notificationService.getUnreadCount(req.user.id)));
});

router.patch('/:id/read', async (req, res) => {
  res.json(success(await notificationService.markAsRead(req.user.id, req.params.id)));
});

router.post('/read-all', async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  res.json(success(null, 'All notifications marked as read'));
});

router.get('/preferences', async (req, res) => {
  res.json(success(await notificationService.getPreferences(req.user.id)));
});

router.put('/preferences', async (req, res) => {
  res.json(success(await notificationService.updatePreference(req.user.id, req.body)));
});

export default router;
