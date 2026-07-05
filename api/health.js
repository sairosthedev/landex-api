/** Lightweight health check — no Express/Mongo import (fast cold start on Vercel). */
export default function handler(_req, res) {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
}
