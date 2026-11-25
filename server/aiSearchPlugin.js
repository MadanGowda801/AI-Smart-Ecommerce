import { createAdminClient } from '@insforge/sdk';
import {
  processAiSearchRequest,
  extractFiltersRuleBased,
  searchProductsInDb,
  validateIntentSchema,
  sanitizeInput,
  sanitizeDbSearchString
} from './aiSearchService.js';

export {
  extractFiltersRuleBased,
  searchProductsInDb,
  validateIntentSchema,
  sanitizeInput,
  sanitizeDbSearchString
};

/**
 * Vite Dev Server Plugin: AI Shopping Search API
 *
 * Endpoints:
 *   POST /api/ai-search  → Parse NL query via Gemini → structured filters → real products
 *
 * SECURITY RULES:
 *   - GEMINI_API_KEY never leaves this file / process.
 *   - All DB reads use InsForge admin client.
 *   - Per-IP rate limiting: max 10 requests per 60 seconds.
 *   - Hard timeout: 8 seconds per Gemini call.
 *   - Input sanitization: message capped at 500 chars, stripped of HTML.
 *   - Error responses never expose internal stack traces.
 */

const MAX_BODY_BYTES = 50 * 1024; // 50 KB request limit to prevent DoS

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytesReceived = 0;

    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_BODY_BYTES) {
        req.destroy();
        return reject(new Error('Request body exceeds maximum allowed size of 50KB'));
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}

export default function aiSearchPlugin(env = {}) {
  const insforgeUrl = env.INSFORGE_URL || process.env.INSFORGE_URL || '';
  const insforgeApiKey = env.INSFORGE_API_KEY || process.env.INSFORGE_API_KEY || '';
  const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

  const admin = (insforgeUrl && insforgeApiKey)
    ? createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeApiKey })
    : null;

  const aiSearchMiddleware = async (req, res, next) => {
    if (req.url !== '/api/ai-search' || req.method !== 'POST') {
      return next();
    }

    const ip = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (bodyErr) {
      return sendJson(res, 400, {
        ok: false,
        error: bodyErr.message || 'Invalid JSON request body.'
      });
    }

    const queryText = body?.query || body?.message;
    const conversationContext = body?.context || body?.conversationContext || [];

    const result = await processAiSearchRequest({
      queryText,
      conversationContext,
      admin,
      geminiApiKey,
      ip
    });

    return sendJson(res, result.status, result.body);
  };

  return {
    name: 'ai-search-plugin',
    configureServer(server) {
      server.middlewares.use(aiSearchMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(aiSearchMiddleware);
    }
  };
}
