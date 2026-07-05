import { Router } from 'express';
import { success } from '../utils/apiResponse.js';
import { requireAuth, resolveClientIp } from '../middleware/auth.js';
import * as authService from '../services/authService.js';

const router = Router();

router.post('/register', async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(success(result, result.message));
});

router.post('/login', async (req, res) => {
  const result = await authService.login(req.body, resolveClientIp(req), req.headers['user-agent']);
  res.json(success(result));
});

router.post('/refresh', async (req, res) => {
  const result = await authService.refreshToken(req.body, resolveClientIp(req), req.headers['user-agent']);
  res.json(success(result));
});

router.post('/logout', requireAuth, async (req, res) => {
  const result = await authService.logout(req.user.id, req.body?.refreshToken);
  res.json(success(result, result.message));
});

router.post('/forgot-password', async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  res.json(success(result, result.message));
});

router.post('/reset-password', async (req, res) => {
  const result = await authService.resetPassword(req.body);
  res.json(success(result, result.message));
});

router.put('/change-password', requireAuth, async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  res.json(success(result, result.message));
});

router.post('/verify-email', async (req, res) => {
  const result = await authService.verifyEmail(req.body);
  res.json(success(result, result.message));
});

router.post('/resend-verification', async (req, res) => {
  const result = await authService.resendVerification(req.body);
  res.json(success(result, result.message));
});

export default router;
