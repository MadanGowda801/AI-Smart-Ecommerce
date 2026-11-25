import { admin } from '../_db.js';
import {
  calculateServerCartPricing,
  resolvePermittedUserContext
} from '../../server/promotionService.js';

const insforgeUrl =
  process.env.INSFORGE_URL ||
  process.env.VITE_INSFORGE_URL ||
  'https://wheg6hgs.ap-southeast.insforge.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const {
      items,
      subtotal,
      couponCode = null,
      couponCodes = null,
      shippingMethod = 'standard',
      strictCatalog = false,
      clientTotals = null
    } = req.body || {};

    const userContext = await resolvePermittedUserContext({
      admin,
      insforgeUrl,
      authHeader: req.headers?.authorization || ''
    });

    const result = await calculateServerCartPricing({
      admin,
      items,
      subtotal,
      couponCode,
      couponCodes,
      shippingMethod,
      userContext,
      clientTotals,
      strictCatalog: Boolean(strictCatalog),
      allowRawSubtotalFallback: !strictCatalog
    });

    if (!result.ok) {
      return res.status(422).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[api/pricing/calculate] error:', err);
    return res.status(500).json({ ok: false, error: 'Internal pricing calculation error' });
  }
}

