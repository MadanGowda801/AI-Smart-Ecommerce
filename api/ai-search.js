/**
 * Serverless Handler: POST /api/ai-search
 *
 * Compatible with Vercel, Node serverless functions, and production hosts.
 */
import { admin } from './_db.js';
import { processAiSearchRequest } from '../server/aiSearchService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const body = req.body || {};

  const queryText = body.query || body.message;
  const conversationContext = body.context || body.conversationContext || [];
  const geminiApiKey = process.env.GEMINI_API_KEY || '';

  const result = await processAiSearchRequest({
    queryText,
    conversationContext,
    admin,
    geminiApiKey,
    ip
  });

  return res.status(result.status).json(result.body);
}
