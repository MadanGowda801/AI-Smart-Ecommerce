/**
 * Serverless Handler: POST /api/compare/products
 * Fetches latest real-time product data & builds category-specific comparison matrix.
 */
import { admin } from '../_db.js';
import { processCompareProductsRequest } from '../../server/compareService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const body = req.body || {};

  const result = await processCompareProductsRequest({
    productIds: body.productIds,
    admin,
    ip
  });

  return res.status(result.status).json(result.body);
}

