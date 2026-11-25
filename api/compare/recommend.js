/**
 * Serverless Handler: POST /api/compare/recommend
 * Revalidates real-time products, runs deterministic weighted scoring,
 * and invokes existing server-side Gemini AI explanation with automatic fallback.
 */
import { admin } from '../_db.js';
import { processCompareRecommendRequest } from '../../server/compareService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const body = req.body || {};
  const geminiApiKey = process.env.GEMINI_API_KEY || '';

  const result = await processCompareRecommendRequest({
    productIds: body.productIds,
    preferences: body.preferences || {},
    admin,
    geminiApiKey,
    ip
  });

  return res.status(result.status).json(result.body);
}

