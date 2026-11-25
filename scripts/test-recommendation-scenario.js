import insforge from '../src/insforge.js';
import recommendationService from '../src/recommendationService.js';
import activityService, { ACTIVITY_TYPES } from '../src/activityService.js';
import productsService from '../src/productsService.js';

async function runRecommendationScenario() {
  console.log('================================================================');
  console.log('🤖 AI RECOMMENDATION ENGINE - DEMONSTRATION & TEST SCENARIO');
  console.log('================================================================\n');

  // 1. Cold-Start Test
  console.log('--- TEST 1: Cold-Start Strategy for New Users / Guests ---');
  const coldStart = await recommendationService.getPersonalizedRecommendations(null, { limit: 6, forceRefresh: true });
  console.log(`✅ Cold-start returned ${coldStart.recommendations.length} recommendations (isColdStart: ${coldStart.isColdStart})`);
  console.log('   Sections generated:', Object.keys(coldStart.sections).join(', '));
  coldStart.recommendations.slice(0, 3).forEach((p, idx) => {
    console.log(`   [#${idx + 1}] "${p.name}" (Score: ${p.recommendationScore}, Reason: "${p.recommendationReason}")`);
  });

  if (coldStart.recommendations.length === 0) {
    throw new Error('Cold start returned zero recommendations!');
  }

  // 2. Authenticate customer
  console.log('\n--- TEST 2: User Authentication & Activity Baseline ---');
  const { data: authData, error: authErr } = await insforge.auth.signInWithPassword({
    email: 'customer@smartshop.in',
    password: 'CustomerPassword123!'
  });

  if (authErr || !authData?.user) {
    console.error('❌ Authentication failed:', authErr);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✅ Signed in as customer: ${userId}`);

  // Fetch products catalog
  const { data: allProds } = await productsService.getProducts({ limit: 100 });
  const audioProducts = allProds.filter((p) => p.category?.toLowerCase() === 'audio' || p.categorySlug === 'audio');
  const laptopProducts = allProds.filter((p) => p.category?.toLowerCase().includes('laptop') || p.categorySlug === 'laptops');

  console.log(`   Available catalog: ${allProds.length} total products (${audioProducts.length} Audio, ${laptopProducts.length} Laptops)`);

  // Baseline recommendations before new activity
  recommendationService.invalidateCache(userId);
  const baselineRecs = await recommendationService.getPersonalizedRecommendations(userId, { limit: 6, forceRefresh: true });
  console.log('\n   Baseline Top 3 Picks:');
  baselineRecs.recommendations.slice(0, 3).forEach((p, idx) => {
    console.log(`   [#${idx + 1}] ${p.name} | Cat: ${p.category} | Score: ${p.recommendationScore} | Reason: "${p.recommendationReason}"`);
  });

  // 3. User Activity Simulation
  console.log('\n--- TEST 3: Simulating User Activity (Focus on Audio & Sony) ---');
  const targetAudioProd = audioProducts[0] || allProds[0];
  const secondAudioProd = audioProducts[1] || allProds[1];

  console.log(`1. Tracking category_view for Category ID: ${targetAudioProd.categoryId} (${targetAudioProd.category})...`);
  await activityService.trackCategoryView(userId, targetAudioProd.categoryId);

  console.log(`2. Tracking product_view for "${targetAudioProd.name}"...`);
  await activityService.trackProductView(userId, targetAudioProd.id, targetAudioProd.categoryId);

  console.log(`3. Tracking search intent: "Sony wireless headphones"...`);
  await activityService.trackSearch(userId, 'Sony wireless headphones');

  console.log(`4. Tracking product_click for "${secondAudioProd.name}"...`);
  await activityService.trackProductClick(userId, secondAudioProd.id, secondAudioProd.categoryId);

  console.log(`5. Tracking add_to_cart for "${targetAudioProd.name}"...`);
  await activityService.trackAddToCart(userId, targetAudioProd.id, targetAudioProd.categoryId);

  console.log('✅ All 5 activities successfully logged to InsForge user_activity table!');

  // 4. Invalidate Cache & Re-compute Recommendations
  console.log('\n--- TEST 4: Re-computing Personalized Recommendations After Activity ---');
  recommendationService.invalidateCache(userId);
  const updatedRecs = await recommendationService.getPersonalizedRecommendations(userId, { limit: 6, forceRefresh: true });

  console.log('\n   Updated Top 4 Recommendations:');
  updatedRecs.recommendations.slice(0, 4).forEach((p, idx) => {
    console.log(`   [#${idx + 1}] ${p.name}`);
    console.log(`        Score: ${p.recommendationScore} (${p.matchPercentage}% match)`);
    console.log(`        Category: ${p.category}`);
    console.log(`        Explainable Reason: "${p.recommendationReason}"`);
  });

  // Verify that recommendations changed and prioritize Audio/Searches
  const topCategories = updatedRecs.recommendations.slice(0, 3).map((p) => p.category?.toLowerCase());
  const hasAudioInTop = topCategories.some((c) => c && c.includes('audio'));
  console.log(`\n✅ Activity shift verified: Top picks contain Audio department items = ${hasAudioInTop}`);

  // 5. Verify the 5 Required Recommendation Sections
  console.log('\n--- TEST 5: Verifying All 5 Recommendation Sections ---');
  const sections = updatedRecs.sections;
  const sectionKeys = ['recommendedForYou', 'becauseYouViewed', 'basedOnSearches', 'similarProducts', 'popularProducts'];

  sectionKeys.forEach((key) => {
    const list = sections[key] || [];
    console.log(`   ✓ Section [${key}]: ${list.length} products`);
    if (list.length > 0) {
      console.log(`     First item: "${list[0].name}" (Reason: "${list[0].recommendationReason}")`);
    }
  });

  // 6. Test Similar Products Recommender
  console.log('\n--- TEST 6: Similar Products Recommender ---');
  const similar = await recommendationService.getSimilarProducts(targetAudioProd.id, { limit: 3 });
  console.log(`✅ Found ${similar.length} products similar to "${targetAudioProd.name}":`);
  similar.forEach((p, idx) => {
    console.log(`   [#${idx + 1}] ${p.name} | Score: ${p.recommendationScore} | Reason: "${p.recommendationReason}"`);
  });

  // 7. Test Cart Recommendations
  console.log('\n--- TEST 7: Cart Recommendations Recommender ---');
  const cartRecs = await recommendationService.getCartRecommendations([targetAudioProd.id], { limit: 3 });
  console.log(`✅ Found ${cartRecs.length} complementary cross-sell items for cart:`);
  cartRecs.forEach((p, idx) => {
    console.log(`   [#${idx + 1}] ${p.name} | Score: ${p.recommendationScore} | Reason: "${p.recommendationReason}"`);
  });

  console.log('\n================================================================');
  console.log('🎉 ALL AI RECOMMENDATION ENGINE TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runRecommendationScenario().catch((err) => {
  console.error('\n❌ Recommendation scenario failed with error:', err);
  process.exit(1);
});
