/**
 * Frontend API Service for AI Smart Product Comparison
 *
 * Calls secure server-side endpoints:
 *   POST /api/compare/products
 *   POST /api/compare/recommend
 *
 * No AI API keys or DB admin keys ever exist in frontend code.
 */

export const compareService = {
  /**
   * Revalidate selected products from live backend database and retrieve
   * category-specific comparison matrix.
   */
  async fetchComparisonMatrix(productIds) {
    const response = await fetch('/api/compare/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds })
    });

    const data = await response.json().catch(() => ({
      ok: false,
      error: 'Unable to parse comparison server response.'
    }));

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || `Comparison service error (${response.status})`);
    }
    return data;
  },

  /**
   * Generate weighted + AI natural-language recommendation for 2-5 products
   * based on selected suggested preferences and manual requirements.
   */
  async generateRecommendation(productIds, preferences) {
    const response = await fetch('/api/compare/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, preferences })
    });

    const data = await response.json().catch(() => ({
      ok: false,
      error: 'Unable to parse AI recommendation response.'
    }));

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || `AI recommendation service error (${response.status})`);
    }
    return data;
  }
};

export default compareService;

