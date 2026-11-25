import { createAdminClient } from '@insforge/sdk';
import {
  processCompareProductsRequest,
  processCompareRecommendRequest
} from './compareService.js';

/**
 * Vite Dev & Preview Server Plugin: AI Smart Product Comparison API
 *
 * Endpoints:
 *   POST /api/compare/products   -> Fetch & revalidate 2-5 products + category-specific comparison matrix
 *   POST /api/compare/recommend  -> Revalidate products + deterministic weighted scoring + server-side AI explanation
 *
 * SECURITY:
 *   - GEMINI_API_KEY and INSFORGE_API_KEY remain strictly server-side.
 *   - Body size capped at 50KB.
 *   - Input sanitized, duplicate/limit validated, per-IP rate limited.
 */

const MAX_BODY_BYTES = 50 * 1024;

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;

    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy();
        return reject(new Error('Request body exceeds maximum allowed size of 50KB.'));
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON request payload.'));
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

export default function comparePlugin(env = {}) {
  const insforgeUrl = env.INSFORGE_URL || process.env.INSFORGE_URL || '';
  const insforgeApiKey = env.INSFORGE_API_KEY || process.env.INSFORGE_API_KEY || '';
  const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

  const admin =
    env.__ADMIN_CLIENT__ !== undefined
      ? env.__ADMIN_CLIENT__
      : insforgeUrl && insforgeApiKey
      ? createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeApiKey })
      : null;

  const compareMiddleware = async (req, res, next) => {
    const rawUrl = req.url || '';
    const pathname = rawUrl.split('?')[0];

    if (pathname !== '/api/compare/products' && pathname !== '/api/compare/recommend') {
      return next();
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { ok: false, error: 'Method not allowed. Use POST.' });
    }

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }

    const ip = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

    if (pathname === '/api/compare/products') {
      const result = await processCompareProductsRequest({
        productIds: body?.productIds,
        admin,
        ip
      });
      return sendJson(res, result.status, result.body);
    }

    if (pathname === '/api/compare/recommend') {
      const result = await processCompareRecommendRequest({
        productIds: body?.productIds,
        preferences: body?.preferences || {},
        admin,
        geminiApiKey,
        ip
      });
      return sendJson(res, result.status, result.body);
    }

    return next();
  };

  return {
    name: 'ai-smart-compare-plugin',
    configureServer(server) {
      server.middlewares.use(compareMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(compareMiddleware);
    }
  };
}

